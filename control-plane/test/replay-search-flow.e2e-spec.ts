import { randomUUID } from 'node:crypto';
import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { DispatchReplayRuns } from '@replays/application/services/dispatch-replay-runs.service';
import { SearchPickDeclined } from '@replays/domain/events/search-pick-declined.event';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { LINE_CHANGED } from '@shared-kernel/application/integration-events/line-changed.integration-event';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { autoSearched } from './support/app';
import { activeSearchAt, dueNow } from './support/auto-searches';
import { eventually } from './support/eventually';
import * as schema from './support/schema';
import {
  ADVISE_ON_STALL,
  anOriginal,
  app,
  auditOf,
  BUILD,
  bearing,
  claimed,
  createSet,
  DELIVERY,
  db,
  delivered,
  drained,
  endedSearchRun,
  entryOf,
  finished,
  fiveTasks,
  judged,
  leasedSearchRun,
  liveBlock,
  noticesSince,
  openSearchFlow,
  originalsOf,
  owner,
  proposing,
  refreshedBefore,
  replayEnded,
  replayRow,
  STUB_GUIDANCE,
  searchedAt,
  searchOf,
  searchRow,
  searchRunsOf,
  searchState,
  setRunsOf,
  startSearch,
  stationPath,
  subscriberDone,
  team,
  teamPath,
  tenTasks,
  turnedOff,
  WITHIN,
} from './support/search-flow';

openSearchFlow();

describe('a search for a better station config', () => {
  it('is started only by Spotlight, and no route starts, reads, lists, picks or stops a search, or reads its set, replays, candidates or runs', async () => {
    const setId = await createSet(tenTasks);

    await owner()
      .post(`${stationPath()}/searches`, {
        setId,
        agent: { harness: 'claude-code' },
        budget: { iterations: 1, perIteration: 1 },
      })
      .expect(404);
    await owner()
      .post(`${stationPath()}/searches/estimate`, { setId })
      .expect(404);
    expect(await db.select().from(schema.replaySearch)).toEqual([]);

    const { id, seedReplayId } = await startSearch({
      iterations: 1,
      ceiling: 20,
    });
    const [seedRun] = await db
      .select({ runId: schema.replayEntry.runId })
      .from(schema.replayEntry)
      .where(eq(schema.replayEntry.replayId, seedReplayId));
    const replayRun = seedRun?.runId ?? randomUUID();

    for (const path of [
      `${stationPath()}/searches`,
      `${stationPath()}/replay-set`,
      `${stationPath()}/improvement`,
      `${teamPath()}/searches`,
      `${teamPath()}/searches/${id}`,
      `${teamPath()}/replay-sets`,
      `${teamPath()}/replay-sets/${setId}/replays`,
      `${teamPath()}/replay-sets/${setId}/replay-checks`,
      `${teamPath()}/replays/${seedReplayId}`,
      `${teamPath()}/replay-runs/${replayRun}`,
      `${teamPath()}/replay-runs/${replayRun}/replay`,
      `${teamPath()}/search-runs/${replayRun}`,
      `${teamPath()}/runs/${replayRun}/notes`,
      `/api/resources/workspaces/${team.workspaceId.value}/replay-candidates`,
    ]) {
      await owner().get(path).expect(404);
    }
    expect(
      (
        (await owner().get(`${teamPath()}/runs`).expect(200)).body as {
          id: string;
        }[]
      ).some((each) => each.id === replayRun),
    ).toBe(false);
    await owner()
      .post(`${teamPath()}/searches/${id}/candidates/${randomUUID()}/pick`)
      .expect(404);
    await owner().post(`${teamPath()}/searches/${id}/stop`).expect(404);
    await owner()
      .post(`${teamPath()}/replay-sets/${setId}/replays`, {
        candidate: 'live',
        ceiling: { amount: 5, currency: 'USD' },
      })
      .expect(404);
    await owner()
      .post(`${teamPath()}/replays/${seedReplayId}/stop`)
      .expect(404);
    await owner()
      .delete(
        `${teamPath()}/replay-sets/${setId}/entries/${tenTasks[0]?.runId}`,
      )
      .expect(404);
    await owner()
      .post(
        `/api/resources/lines/${DELIVERY}/stations/build/replay-candidates`,
        {
          name: 'Shorter',
          station: { key: 'build' },
        },
      )
      .expect(404);
    await owner()
      .get(`${teamPath()}/config-pull-requests/${randomUUID()}`)
      .expect(404);
    expect(
      (await auditOf(id)).map((each) => [
        each.resource,
        each.action,
        each.actor,
      ]),
    ).toEqual([['replay-search', 'created', 'spotlight']]);

    await turnedOff(id);
    await eventually(
      async () => (await replayRow(seedReplayId))?.state === 'stopped',
      WITHIN,
    );
  }, 120_000);

  it('replays the live config first, then runs its agent, takes its candidates only on the searched tasks, shows it no held-out task, holds out its frontier, finishes, and tells nobody when it opens no pull request', async () => {
    const setId = await createSet(tenTasks);
    const searchedFrom = new Date();
    const { id, seedReplayId } = await startSearch({
      iterations: 2,
      ceiling: 60,
    });

    const started = await searchOf(id);

    expect(started.state).toBe('seeding');
    expect(started.split.heldOut).toHaveLength(3);
    expect((await replayRow(seedReplayId))?.searchId).toBe(id);
    expect((await replayRow(seedReplayId))?.baseline).toBe(true);
    expect(await searchRunsOf(id)).toEqual([]);

    const extra = await anOriginal();
    expect(await refreshedBefore(setId)).toBe(false);
    await dueNow(searchedAt());
    await autoSearched(app);
    expect(
      (await db.select().from(schema.replaySearch))
        .filter((each) => each.stationId === BUILD && each.state !== 'stopped')
        .map((each) => each.id),
    ).toEqual([id]);

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
        runs: {
          original: string;
          taskId: string;
          succeeded: boolean | null;
          guidance: string | null;
        }[];
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
      [
        ...new Set(history.candidates[0]?.runs.map((each) => each.original)),
      ].sort(),
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
    for (const path of [
      `${teamPath()}/runs/${agent.runId}/config`,
      `${teamPath()}/runs/${agent.runId}/notes`,
      `/api/runs/${agent.runId}/stream`,
    ]) {
      await owner().get(path).expect(404);
    }
    await proposing(agent, {
      name: 'late',
      hypothesis: 'Too late.',
      station: block,
    }).expect(404);

    expect((await replayRow(seedReplayId))?.searchId).toBe(id);

    await drained((replayId) =>
      replayId === strong.replayId
        ? { score: 5, cost: 0.1 }
        : { score: 2, cost: 0.1 },
    );
    expect(await replayEnded(strong.replayId)).toBe('finished');

    expect((await replayRow(strong.replayId))?.searchId).toBe(id);
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
      expect(
        [...new Set(candidate.runs.map((each) => each.original))].sort(),
      ).toEqual(searchedRuns);
      expect(
        candidate.runs.some((each) => heldOutTaskIds.has(each.taskId)),
      ).toBe(false);
    }
    expect(
      later.candidates[2]?.runs.every((each) => each.succeeded === false),
    ).toBe(true);
    expect(
      later.candidates[2]?.runs.every(
        (each) => each.guidance === STUB_GUIDANCE,
      ),
    ).toBe(true);
    expect(
      later.candidates[1]?.runs.every((each) => each.guidance === null),
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
    expect(current.stopReason).toBe('iterations-spent');
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

    expect(done.stopReason).toBe('iterations-spent');
    expect(done.candidates.map((each) => [each.name, each.onFrontier])).toEqual(
      [
        ['in-order', true],
        ['terse', false],
      ],
    );
    expect(done.candidates[0]?.searchScore).toBe(1);
    expect(done.candidates[0]?.heldOutScore).toBe(1);
    expect(done.candidates[1]?.searchScore).toBe(0);
    expect(done.candidates.map((each) => each.overfit)).toEqual([null, null]);
    expect(done.best?.overfit).toBeNull();
    expect(done.frontier).toContain(done.seed.candidateId);
    expect(done.best?.name).toBe('in-order');
    expect(done.spent.amount).toBeGreaterThan(0);

    expect(
      (await auditOf(id)).map((each) => [each.resource, each.action]),
    ).toEqual([['replay-search', 'created']]);
    expect(done.trigger).toBe('schedule');
    expect(
      await eventually(async () => (await searchOf(id)).pick, WITHIN),
    ).toEqual({
      outcome: 'declined',
      candidateId: null,
      name: null,
      reason: 'no-held-out-gain',
    });
    expect(
      await db
        .select()
        .from(schema.configPullRequest)
        .where(eq(schema.configPullRequest.searchId, id)),
    ).toEqual([]);

    await eventually(() => subscriberDone(ADVISE_ON_STALL), WITHIN);
    expect(await noticesSince(searchedFrom)).toEqual([]);

    const declined = new SearchPickDeclined(
      SearchId.of(id),
      team.workspaceId,
      'no-held-out-gain',
    );

    await delivered(declined);
    await delivered(declined);

    expect(await noticesSince(searchedFrom)).toEqual([]);

    expect(await refreshedBefore(setId)).toBe(true);
    expect(await setRunsOf(setId)).toContain(extra.runId);
  }, 120_000);

  it('ends when its seed spends past its ceiling, and when its search policy is turned off in the line or at the station alone', async () => {
    await createSet(fiveTasks);
    const capped = await startSearch({
      iterations: 1,
      ceiling: 1,
    });

    await drained(() => ({ score: 4, cost: 5 }));
    await eventually(
      async () => (await searchState(capped.id)) === 'finished',
      WITHIN,
    );

    expect((await searchRow(capped.id))?.stopReason).toBe('ceiling-reached');
    expect((await replayRow(capped.seedReplayId))?.state).toBe(
      'ceiling-reached',
    );
    expect(await searchRunsOf(capped.id)).toEqual([]);
    expect(
      await eventually(async () => (await searchOf(capped.id)).pick, WITHIN),
    ).toMatchObject({ outcome: 'declined' });

    const stopped = await startSearch({
      iterations: 3,
      ceiling: 20,
    });

    const [line] = await db
      .select({ search: schema.line.search })
      .from(schema.line)
      .where(eq(schema.line.id, DELIVERY));

    await db
      .update(schema.line)
      .set({ search: { ...(line?.search as object), enabled: false } as never })
      .where(eq(schema.line.id, DELIVERY));
    await delivered({
      kind: LINE_CHANGED,
      lineId: DELIVERY,
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      stationIds: [BUILD],
    } as never);

    expect((await searchRow(stopped.id))?.stopReason).toBe('turned-off');
    expect((await searchRow(stopped.id))?.state).toBe('stopped');
    await eventually(
      async () => (await replayRow(stopped.seedReplayId))?.state === 'stopped',
      WITHIN,
    );
    expect(await activeSearchAt(searchedAt())).toBeUndefined();

    const again = await startSearch({ iterations: 3, ceiling: 20 });
    const [station] = await db
      .select({ search: schema.station.search })
      .from(schema.station)
      .where(eq(schema.station.id, BUILD));

    await db
      .update(schema.station)
      .set({
        search: { ...(station?.search as object), enabled: false } as never,
      })
      .where(eq(schema.station.id, BUILD));
    await delivered({
      kind: LINE_CHANGED,
      lineId: DELIVERY,
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      stationIds: [BUILD],
    } as never);

    expect(await searchRow(again.id)).toMatchObject({
      state: 'stopped',
      stopReason: 'turned-off',
    });
    expect(
      await db
        .select()
        .from(schema.configPullRequest)
        .where(eq(schema.configPullRequest.searchId, again.id)),
    ).toEqual([]);
  }, 120_000);
});
