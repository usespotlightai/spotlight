import { createHash, randomUUID } from 'node:crypto';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { estimateOf } from '@replays/domain/services/search-estimate';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { TEST_USER_HEADER } from './support/app';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import {
  anOriginal,
  app,
  auditOf,
  BUILD,
  bearing,
  budgetOf,
  claimed,
  db,
  drained,
  endedSearchRun,
  entryOf,
  finished,
  fiveTasks,
  http,
  judged,
  leasedSearchRun,
  liveBlock,
  openSearchFlow,
  openSet,
  originalsOf,
  owner,
  proposing,
  replayEnded,
  replayRow,
  searchOf,
  searchRow,
  searchRunsOf,
  searchState,
  startSearch,
  stationPath,
  teamPath,
  tenTasks,
  tokenWith,
  WITHIN,
} from './support/search-flow';

openSearchFlow();

describe('a search for a better station config', () => {
  it('estimates what it would start, spend and take, as its budget allots it, writing nothing', async () => {
    const setId = await openSet('Estimated', tenTasks);
    const budget = { iterations: 2, perIteration: 2, ceiling: 40 };

    const estimate = (
      await owner()
        .post(`${stationPath()}/searches/estimate`, {
          setId,
          budget: budgetOf(budget),
        })
        .expect(200)
    ).body as {
      searchedTasks: number;
      heldOutTasks: number;
      runs: Record<string, number>;
      perReplayAllotments: Record<string, { amount: number }>;
      estimatedDuration: number | null;
      minGain: number;
      objective: string;
      warnings: { kind: string }[];
    };
    const split = HeldOutSplit.drawn({
      searchId: SearchId.of('estimate'),
      entries: tenTasks.map((each) =>
        ReplaySetEntry.of({
          runId: RunId.of(each.runId),
          taskId: TaskId.of(each.taskId),
          addedAt: new Date(),
        }),
      ),
      digest: (text) => createHash('sha256').update(text, 'utf8').digest('hex'),
    });
    const expected = estimateOf(
      SearchBudget.of({
        iterations: 2,
        perIteration: 2,
        ceiling: Spend.ceiling(40, 'USD'),
        concurrency: 10,
      }),
      split,
      [],
    );

    expect(estimate.searchedTasks).toBe(7);
    expect(estimate.heldOutTasks).toBe(3);
    expect(estimate.runs).toEqual(expected.runs);
    expect(estimate.perReplayAllotments.seed?.amount).toBeCloseTo(
      expected.allotment.seed.amount,
      6,
    );
    expect(estimate.perReplayAllotments.searchReplay?.amount).toBeCloseTo(
      expected.allotment.searchReplay.amount,
      6,
    );
    expect(estimate.perReplayAllotments.heldOutReplay?.amount).toBeCloseTo(
      expected.allotment.heldOutReplay.amount,
      6,
    );
    expect(estimate.estimatedDuration).toBeNull();
    expect(estimate.minGain).toBe(0.05);
    expect(estimate.objective).toBe('success');
    expect(estimate.warnings).toEqual([{ kind: 'noise-unmeasured' }]);
    expect(await db.select().from(schema.replaySearch)).toEqual([]);

    const repeated = (
      await owner()
        .post(`${stationPath()}/searches/estimate`, {
          setId,
          budget: { ...budgetOf(budget), repeats: 2 },
        })
        .expect(200)
    ).body as { runs: Record<string, number> };

    expect(repeated.runs).toEqual({
      seed: expected.runs.seed * 2,
      searchReplays: expected.runs.searchReplays * 2,
      heldOutReplays: expected.runs.heldOutReplays * 2,
      agent: expected.runs.agent,
      total: expected.runs.total * 2 - expected.runs.agent,
    });

    await owner()
      .post(`${stationPath()}/searches/estimate`, {
        setId,
        budget: budgetOf({ ...budget, iterations: 11 }),
      })
      .expect(422)
      .expect((answer) =>
        expect(answer.body.errors).toEqual([
          expect.objectContaining({
            path: 'budget.iterations',
            severity: 'error',
          }),
        ]),
      );

    const reader = await tokenWith(['read']);
    const stranger = randomUUID();

    await db.insert(schema.user).values({
      id: stranger,
      name: 'Eve',
      email: `${stranger}@example.com`,
    });
    await bearing(reader).get(`${stationPath()}/searches`).expect(200);
    await bearing(reader).get(`${teamPath()}/searches`).expect(200);
    await bearing(reader)
      .post(`${stationPath()}/searches/estimate`, {
        setId,
        budget: budgetOf(budget),
      })
      .expect(200);
    await bearing(reader)
      .post(`${stationPath()}/searches`, {
        setId,
        agent: { harness: 'claude-code' },
        budget: budgetOf(budget),
      })
      .expect(403);
    await http()
      .get(`${teamPath()}/searches`)
      .set(TEST_USER_HEADER, stranger)
      .expect(404);
    await owner()
      .post(`${stationPath()}/searches`, {
        setId,
        agent: { harness: 'no-such-harness' },
        budget: budgetOf(budget),
      })
      .expect(422)
      .expect((answer) =>
        expect(
          answer.body.errors.map((each: { path: string }) => each.path),
        ).toEqual(['agent.harness']),
      );
    expect(await db.select().from(schema.replaySearch)).toEqual([]);
  }, 120_000);

  it('replays the live config first, then runs its agent, takes its candidates only on the searched tasks, shows it no held-out task, holds out its frontier, and finishes', async () => {
    const setId = await openSet('Searched', tenTasks);
    const { id, seedReplayId } = await startSearch(setId, {
      iterations: 2,
      perIteration: 2,
      ceiling: 60,
    });

    const started = await searchOf(id);

    expect(started.state).toBe('seeding');
    expect(started.split.heldOut).toHaveLength(3);
    expect((await replayRow(seedReplayId))?.searchId).toBe(id);
    expect((await replayRow(seedReplayId))?.baseline).toBe(true);
    expect(await searchRunsOf(id)).toEqual([]);

    const extra = await anOriginal();
    await owner()
      .post(`${teamPath()}/replay-sets/${setId}/entries`, {
        runId: extra.runId,
      })
      .expect(409);
    await owner()
      .delete(
        `${teamPath()}/replay-sets/${setId}/entries/${tenTasks[0]?.runId}`,
      )
      .expect(409);
    await owner().delete(`${teamPath()}/replay-sets/${setId}`).expect(409);
    await owner()
      .post(`${stationPath()}/searches`, {
        setId,
        agent: { harness: 'claude-code' },
        budget: budgetOf({ iterations: 1, perIteration: 1, ceiling: 10 }),
      })
      .expect(409);

    await drained(() => ({ score: 4, cost: 0.2 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');

    const agent = await leasedSearchRun(id, 1);
    const heldOutTaskIds = new Set(
      started.split.heldOut.map((each) => each.taskId),
    );
    const heldOutRuns = started.split.heldOut.map((each) => each.runId).sort();
    const searchedRuns = started.split.searched
      .map((each) => each.runId)
      .sort();

    const history = (
      await bearing(agent.token)
        .get(`/api/runs/${agent.runId}/history?station=build`)
        .expect(200)
    ).body as {
      runs: { taskId: string; runId: string }[];
      candidates: {
        candidateName: string;
        runs: { original: string; taskId: string; succeeded: boolean | null }[];
      }[];
      seedBlock: { key: string };
    };

    expect(history.seedBlock.key).toBe('build');
    expect(history.runs.some((each) => heldOutTaskIds.has(each.taskId))).toBe(
      false,
    );
    expect(history.candidates.map((each) => each.candidateName)).toEqual([
      'seed',
    ]);
    expect(
      history.candidates[0]?.runs.map((each) => each.original).sort(),
    ).toEqual(searchedRuns);
    expect(
      history.candidates[0]?.runs.every((each) => each.succeeded === true),
    ).toBe(true);

    const block = await liveBlock();
    const rejected = await proposing(agent, {
      name: 'Not a slug',
      hypothesis: '',
      station: { ...block, passesTo: [] },
    }).expect(422);

    expect(rejected.body.errors).toEqual(
      expect.arrayContaining([
        { path: 'name', message: expect.any(String), severity: 'error' },
        { path: 'hypothesis', message: expect.any(String), severity: 'error' },
        {
          path: 'station.passesTo',
          message: expect.any(String),
          severity: 'error',
        },
      ]),
    );

    const strong = (
      await proposing(agent, {
        name: 'in-order',
        hypothesis: 'Draining in order stops the stall.',
        station: { ...block, prompt: 'Build it, draining in order.' },
      }).expect(201)
    ).body as { candidateId: string; name: string; replayId: string };
    const again = await proposing(agent, {
      name: 'in-order',
      hypothesis: 'Proposed twice.',
      station: { ...block, prompt: 'Build it, draining in order.' },
    }).expect(201);
    const terse = {
      name: 'terse',
      hypothesis: 'Less to read is less to get wrong.',
      station: { ...block, prompt: 'Build.' },
    };
    const [one, other] = await Promise.all([
      proposing(agent, terse),
      proposing(agent, terse),
    ]);

    expect([one.status, other.status]).toEqual([201, 201]);
    expect(one.body).toEqual(other.body);

    const weak = one.body as { candidateId: string; replayId: string };

    expect(
      (
        await db
          .select()
          .from(schema.replayCandidate)
          .where(eq(schema.replayCandidate.searchId, id))
      ).map((each) => each.name),
    ).toEqual(expect.arrayContaining(['in-order', 'terse']));
    expect(
      await db
        .select()
        .from(schema.replayCandidate)
        .where(eq(schema.replayCandidate.searchId, id)),
    ).toHaveLength(2);

    await app.get(DispatchReplayRuns).processDue();
    const bystander = await claimed();

    if (!bystander) {
      throw new Error('no replay run waited to be claimed');
    }

    const byStander = await bearing(bystander.token)
      .post(`/api/runs/${agent.runId}/search-candidates`, {
        name: 'stranger',
        hypothesis: 'Not my run.',
        station: { ...block, prompt: 'Build it, stranger.' },
      })
      .expect(404);

    expect(byStander.body.detail).toBe(
      'This run is no longer the active run of the search',
    );
    await finished(
      bystander,
      ((await entryOf(bystander.runId))?.replayId ?? '') === strong.replayId
        ? 5
        : 2,
      0.1,
    );

    expect(again.body).toEqual(strong);
    await proposing(agent, {
      name: 'third',
      hypothesis: 'One too many.',
      station: { ...block, prompt: 'Build it twice.' },
    }).expect(409);
    expect(await originalsOf(strong.replayId)).toEqual(searchedRuns);
    expect(await originalsOf(weak.replayId)).toEqual(searchedRuns);

    await endedSearchRun(agent);
    await proposing(agent, {
      name: 'late',
      hypothesis: 'Too late.',
      station: block,
    }).expect(404);

    await eventually(async () => {
      const read = await owner().get(
        `${teamPath()}/search-runs/${agent.runId}`,
      );

      return read.status === 200 && read.body.spent.spentCosts.length > 0;
    }, WITHIN);

    const searchRun = (
      await owner().get(`${teamPath()}/search-runs/${agent.runId}`).expect(200)
    ).body as {
      searchId: string;
      iteration: number;
      state: string;
      agent: { harness: string; model: string | null; effort: string | null };
      spent: {
        spentCosts: { amount: number; currency: string }[];
        unpricedCalls: number;
      };
      journals: unknown[];
      briefing: string;
    };
    const [dispatched] = await db
      .select({ spec: schema.run.spec })
      .from(schema.run)
      .where(eq(schema.run.id, agent.runId));

    expect(searchRun.briefing).toBe(
      (dispatched?.spec as { briefing: string } | undefined)?.briefing,
    );
    expect(searchRun).toMatchObject({
      searchId: id,
      iteration: 1,
      state: 'completed',
      agent: { harness: 'claude-code', model: null, effort: 'high' },
      spent: {
        spentCosts: [{ amount: 0.05, currency: 'USD' }],
        unpricedCalls: 0,
      },
    });
    expect(searchRun.journals.length).toBeGreaterThan(0);
    await bearing(await tokenWith(['read']))
      .get(`${teamPath()}/search-runs/${agent.runId}`)
      .expect(200);
    await owner()
      .get(`${teamPath()}/search-runs/${tenTasks[0]?.runId}`)
      .expect(404);

    const seedRead = (
      await owner().get(`${teamPath()}/replays/${seedReplayId}`).expect(200)
    ).body as { search: { searchId: string; candidateName: string } | null };

    expect(seedRead.search).toEqual({ searchId: id, candidateName: 'seed' });

    await drained((replayId) =>
      replayId === strong.replayId
        ? { score: 5, cost: 0.1 }
        : { score: 2, cost: 0.1 },
    );
    expect(await replayEnded(strong.replayId)).toBe('finished');

    const [strongRun] = await db
      .select({ runId: schema.replayEntry.runId })
      .from(schema.replayEntry)
      .where(eq(schema.replayEntry.replayId, strong.replayId));
    const ofRun = (
      await owner()
        .get(`${teamPath()}/replay-runs/${strongRun?.runId}/replay`)
        .expect(200)
    ).body as { search: { searchId: string; candidateName: string } | null };

    expect(ofRun.search).toEqual({ searchId: id, candidateName: 'in-order' });
    expect(await replayEnded(weak.replayId)).toBe('finished');

    const second = await leasedSearchRun(id, 2);
    const later = (
      await bearing(second.token)
        .get(`/api/runs/${second.runId}/history?station=build`)
        .expect(200)
    ).body as typeof history;

    expect(later.candidates.map((each) => each.candidateName)).toEqual([
      'seed',
      'in-order',
      'terse',
    ]);
    for (const candidate of later.candidates) {
      expect(candidate.runs.map((each) => each.original).sort()).toEqual(
        searchedRuns,
      );
      expect(
        candidate.runs.some((each) => heldOutTaskIds.has(each.taskId)),
      ).toBe(false);
    }
    expect(
      later.candidates[2]?.runs.every((each) => each.succeeded === false),
    ).toBe(true);
    expect(later.runs.some((each) => heldOutTaskIds.has(each.taskId))).toBe(
      false,
    );

    await endedSearchRun(second);
    await eventually(async () => {
      await app.get(AdvanceSearches).processDue();
      return (await searchRow(id))?.heldOut.length === 1;
    }, WITHIN);

    const current = await searchOf(id);
    const heldOutReplayId = current.candidates.find(
      (each) => each.name === 'in-order',
    )?.heldOutReplayId as string;

    expect(current.state).toBe('holding-out');
    expect(current.ending).toBe('iterations-spent');
    expect(
      current.candidates.find((each) => each.name === 'terse')?.heldOutReplayId,
    ).toBeNull();
    expect(await originalsOf(heldOutReplayId)).toEqual(heldOutRuns);

    await drained(() => ({ score: 5, cost: 0.1 }));
    await eventually(async () => {
      await judged();
      return (await searchState(id)) === 'finished';
    }, WITHIN);

    const done = await searchOf(id);

    expect(done.ending).toBe('iterations-spent');
    expect(done.candidates.map((each) => [each.name, each.onFrontier])).toEqual(
      [
        ['in-order', true],
        ['terse', false],
      ],
    );
    expect(done.candidates[0]?.searchScore).toBe(1);
    expect(done.candidates[0]?.heldOutScore).toBe(1);
    expect(done.candidates[1]?.searchScore).toBe(0);
    expect(done.candidates.map((each) => each.onlyOnSeenTasks)).toEqual([
      null,
      null,
    ]);
    expect(done.onlyOnSeenTasks).toBe(0);
    expect(done.best?.onlyOnSeenTasks).toBeNull();
    expect(done.frontier).toContain(done.seed.candidateId);
    expect(done.best?.name).toBe('in-order');
    expect(done.spent.amount).toBeGreaterThan(0);

    const listed = (await owner().get(`${stationPath()}/searches`).expect(200))
      .body as { id: string; best: { name: string } | null }[];
    const ofTeam = (await owner().get(`${teamPath()}/searches`).expect(200))
      .body as { id: string; stationId: string; state: string }[];

    expect(listed.find((each) => each.id === id)?.best?.name).toBe('in-order');
    expect(ofTeam.find((each) => each.id === id)).toMatchObject({
      stationId: BUILD,
      state: 'finished',
    });
    expect(
      (await auditOf(id)).map((each) => [each.resource, each.action]),
    ).toEqual([['replay-search', 'created']]);

    await owner()
      .post(`${teamPath()}/replay-sets/${setId}/entries`, {
        runId: extra.runId,
      })
      .expect(204);
  }, 120_000);

  it('ends when its seed spends past its ceiling, and when a person stops it', async () => {
    const setId = await openSet('Capped', fiveTasks);
    const capped = await startSearch(setId, {
      iterations: 1,
      perIteration: 1,
      ceiling: 1,
    });

    await drained(() => ({ score: 4, cost: 5 }));
    await eventually(
      async () => (await searchState(capped.id)) === 'finished',
      WITHIN,
    );

    expect((await searchRow(capped.id))?.ending).toBe('ceiling-reached');
    expect((await replayRow(capped.seedReplayId))?.state).toBe('over-budget');
    expect(await searchRunsOf(capped.id)).toEqual([]);

    const stopped = await startSearch(setId, {
      iterations: 3,
      perIteration: 1,
      ceiling: 20,
    });

    await owner().post(`${teamPath()}/searches/${stopped.id}/stop`).expect(204);
    await owner().post(`${teamPath()}/searches/${stopped.id}/stop`).expect(409);

    expect((await searchRow(stopped.id))?.ending).toBe('stopped');
    await eventually(
      async () => (await replayRow(stopped.seedReplayId))?.state === 'stopped',
      WITHIN,
    );
    expect(
      (await auditOf(stopped.id)).map((each) => [each.resource, each.action]),
    ).toEqual(
      expect.arrayContaining([
        ['replay-search', 'created'],
        ['replay-search', 'updated'],
      ]),
    );
  }, 120_000);
});
