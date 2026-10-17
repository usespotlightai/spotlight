import { AdvanceSearches } from '@replays/application/services/advance-searches.service';
import { OpenConfigPullRequests } from '@replays/application/services/open-config-pull-requests.service';
import { describe, expect, it } from 'vitest';
import { eventually } from './support/eventually';
import {
  app,
  auditOf,
  bearing,
  budgetOf,
  CONFIG,
  CONFIG_FILE,
  CONFIG_LINE,
  drained,
  endedSearchRun,
  fiveTasks,
  github,
  judged,
  leasedSearchRun,
  liveBlock,
  openSearchFlow,
  openSet,
  owner,
  PROMPT_FILE,
  proposing,
  replayEnded,
  replayRow,
  type SearchRead,
  searchOf,
  searchRow,
  searchState,
  startSearch,
  stationPath,
  team,
  teamPath,
  tenTasks,
  tokenWith,
  WITHIN,
} from './support/search-flow';

openSearchFlow();

describe('a search for a better station config, ranking and picking its candidates', () => {
  it('looks for the same success at less cost on a set its live config saturates, ranking the cheapest candidate that succeeds as often first and leaving out a cheaper one that succeeds less', async () => {
    const setId = await openSet('Saturated', tenTasks);
    const live = (
      await owner()
        .post(`${teamPath()}/replay-sets/${setId}/replays`, {
          candidate: 'live',
          ceiling: { amount: 20, currency: 'USD' },
        })
        .expect(201)
    ).body as { id: string };

    await eventually(async () => {
      await drained(() => ({ score: 5, cost: 0.2 }));
      return (await replayRow(live.id))?.state === 'finished';
    }, WITHIN);
    expect(await replayEnded(live.id)).toBe('finished');

    const budget = { iterations: 2, perIteration: 3, ceiling: 60 };
    const estimate = (
      await owner()
        .post(`${stationPath()}/searches/estimate`, {
          setId,
          budget: budgetOf(budget),
        })
        .expect(200)
    ).body as { objective: string; warnings: { kind: string }[] };
    const told = (
      await owner()
        .post(`${stationPath()}/searches/estimate`, {
          setId,
          budget: budgetOf(budget),
          objective: 'success',
        })
        .expect(200)
    ).body as { objective: string };

    expect(estimate.objective).toBe('cost');
    expect(estimate.warnings).toContainEqual({ kind: 'saturated', rate: 1 });
    expect(told.objective).toBe('success');
    await owner()
      .post(`${stationPath()}/searches/estimate`, {
        setId,
        budget: budgetOf(budget),
        objective: 'speed',
      })
      .expect(422);

    const started = (
      await owner()
        .post(`${stationPath()}/searches`, {
          setId,
          agent: { harness: 'claude-code', model: null, effort: 'high' },
          budget: budgetOf(budget),
        })
        .expect(201)
    ).body as { id: string; seedReplayId: string; objective: string };

    expect(started.objective).toBe('cost');
    expect((await searchRow(started.id))?.objective).toBe('cost');

    await drained(() => ({ score: 5, cost: 0.2 }));
    expect(await replayEnded(started.seedReplayId)).toBe('finished');

    const agent = await leasedSearchRun(started.id, 1);
    const block = await liveBlock();
    const proposed = async (name: string, prompt: string) =>
      (
        await proposing(agent, {
          name,
          hypothesis: `${name} keeps the queue drained for less.`,
          station: { ...block, prompt },
        }).expect(201)
      ).body as { replayId: string };
    const cheap = await proposed('cheap', 'Build it, briefly.');
    const dear = await proposed('dear', 'Build it, at length.');
    const careless = await proposed('careless', 'Build it, carelessly.');
    const plan = (replayId: string) =>
      replayId === cheap.replayId
        ? { score: 5, cost: 0.05 }
        : replayId === dear.replayId
          ? { score: 5, cost: 0.5 }
          : replayId === careless.replayId
            ? { score: 1, cost: 0.01 }
            : { score: 5, cost: 0.05 };

    await endedSearchRun(agent);
    await drained(plan);
    await endedSearchRun(await leasedSearchRun(started.id, 2));
    await eventually(async () => {
      await app.get(AdvanceSearches).processDue();
      return (await searchRow(started.id))?.heldOut.length === 1;
    }, WITHIN);
    await drained(plan);
    await eventually(async () => {
      await judged();
      return (await searchState(started.id)) === 'finished';
    }, WITHIN);

    const done = (await searchOf(started.id)) as SearchRead & {
      objective: string;
    };

    expect(done.objective).toBe('cost');
    expect(done.best?.name).toBe('cheap');
    expect(done.candidates.map((each) => [each.name, each.onFrontier])).toEqual(
      [
        ['cheap', true],
        ['dear', false],
        ['careless', false],
      ],
    );
    expect(
      done.candidates.map((each) => [each.name, each.heldOutReplayId !== null]),
    ).toEqual([
      ['cheap', true],
      ['dear', false],
      ['careless', false],
    ]);
    expect(done.frontier).toEqual([
      done.candidates[0]?.candidateId,
      done.seed.candidateId,
    ]);
  }, 120_000);

  it('opens one pull request in the line’s config repository for a picked candidate, records why one failed, and tries again when picked again', async () => {
    const setId = await openSet('Picked', fiveTasks);
    const { id, seedReplayId } = await startSearch(setId, {
      iterations: 1,
      perIteration: 1,
      ceiling: 20,
    });

    await drained(() => ({ score: 3, cost: 0.1 }));
    expect(await replayEnded(seedReplayId)).toBe('finished');

    const agent = await leasedSearchRun(id, 1);
    const block = await liveBlock();
    const proposed = (
      await proposing(agent, {
        name: 'in-order',
        hypothesis: 'Draining in order stops the stall.',
        station: { ...block, prompt: 'Build it, draining in order.\n' },
      }).expect(201)
    ).body as { candidateId: string; replayId: string };
    const pickPath = (candidateId: string) =>
      `${teamPath()}/searches/${id}/candidates/${candidateId}/pick`;

    await owner().post(pickPath(proposed.candidateId)).expect(409);

    await endedSearchRun(agent);
    await drained(() => ({ score: 5, cost: 0.1 }));
    expect(await replayEnded(proposed.replayId)).toBe('finished');

    const searched = await searchOf(id);
    const reader = await tokenWith(['read']);

    await owner().post(pickPath(searched.seed.candidateId)).expect(409);
    await bearing(reader).post(pickPath(proposed.candidateId)).expect(403);

    github.files.set(CONFIG_FILE, CONFIG_LINE);
    github.files.set(PROMPT_FILE, 'Build it, some other way.');

    const [one, other] = await Promise.all([
      owner().post(pickPath(proposed.candidateId)),
      owner().post(pickPath(proposed.candidateId)),
    ]);

    expect([one.status, other.status].sort()).toEqual([200, 201]);
    expect(one.body.id).toBe(other.body.id);
    expect(one.body).toMatchObject({
      repository: CONFIG,
      path: CONFIG_FILE,
      branch: `spotlight/search-${id.slice(0, 8)}-in-order`,
      attempts: 1,
    });

    const pullRequestPath = `${teamPath()}/config-pull-requests/${one.body.id}`;
    const attempted = () =>
      eventually(async () => {
        await app.get(OpenConfigPullRequests).processDue();
        const read = (await owner().get(pullRequestPath).expect(200)).body as {
          state: string;
        };

        return read.state === 'opening' ? null : read;
      }, WITHIN);

    expect(await attempted()).toMatchObject({
      state: 'failed',
      url: null,
      reason: { code: 'base-changed', attribute: 'prompt' },
    });
    expect(github.commits).toEqual([]);

    github.files.set(PROMPT_FILE, 'Build it.');
    const retried = await owner()
      .post(pickPath(proposed.candidateId))
      .expect(201);

    expect(retried.body).toMatchObject({
      id: one.body.id,
      state: 'opening',
      attempts: 2,
      reason: null,
    });
    expect(await attempted()).toMatchObject({
      state: 'opened',
      url: `https://github.com/${CONFIG}/pull/1`,
      reason: null,
    });
    await owner().post(pickPath(proposed.candidateId)).expect(200);
    await app.get(OpenConfigPullRequests).processDue();

    expect(github.opened).toHaveLength(1);
    expect(github.opened[0]).toMatchObject({
      branch: `spotlight/search-${id.slice(0, 8)}-in-order`,
      title: 'build: in-order',
    });
    expect(github.opened[0]?.body).toContain(
      'Draining in order stops the stall.',
    );
    expect(github.commits).toHaveLength(1);
    expect(github.commits[0]?.replacing).toBeNull();
    expect(github.commits[0]?.files).toEqual([
      {
        path: CONFIG_FILE,
        content: CONFIG_LINE.replace(
          'prompts/build.md',
          `prompts/${team.slug}/delivery/build.md`,
        ),
      },
      {
        path: `teams/core/prompts/${team.slug}/delivery/build.md`,
        content: 'Build it, draining in order.\n',
      },
    ]);
    expect(github.files.get(PROMPT_FILE)).toBe('Build it.');
    expect(
      (await searchOf(id)).candidates.find(
        (each) => each.candidateId === proposed.candidateId,
      ),
    ).toMatchObject({
      pullRequest: {
        id: one.body.id,
        state: 'opened',
        url: `https://github.com/${CONFIG}/pull/1`,
      },
    });
    expect(
      (await auditOf(one.body.id)).map((each) => [each.resource, each.action]),
    ).toEqual([
      ['config-pull-request', 'created'],
      ['config-pull-request', 'updated'],
    ]);

    const stopped = await owner().post(`${teamPath()}/searches/${id}/stop`);

    expect([204, 409]).toContain(stopped.status);
  }, 120_000);
});
