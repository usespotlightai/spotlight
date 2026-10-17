import { describe, expect, it } from 'vitest';
import {
  addReplaySetEntry,
  listReplayableRuns,
  listReplayCandidates,
  listReplaySetChecks,
  listReplaySetSuggestions,
  listReplaySets,
  listReplays,
  listSearches,
  listStationOutcomes,
  listTeamReplaySets,
  openReplaySet,
  pickSearchCandidate,
  readReplay,
  readReplayedCandidates,
  readReplayOfRun,
  readReplayRun,
  readSearch,
  readSearchRun,
  readStationJudge,
  startReplay,
  stopSearch,
} from '@/lib/api';
import { serveMockApi } from '@/mocks/testing';
import { DELIVERY_ID, PLATFORM_ID, WORKSPACE } from '@/mocks/world';

const IMPLEMENTATION = {
  teamId: PLATFORM_ID,
  lineId: DELIVERY_ID,
  stationId: 'station_implementation',
};

const TRIAGE = { ...IMPLEMENTATION, stationId: 'station_triage' };

describe('the mock station', () => {
  serveMockApi();

  it('groups the implementation runs by config version, newest from the tests-first pull request', async () => {
    const { data } = await listStationOutcomes({
      path: IMPLEMENTATION,
      query: { last: 200 },
      throwOnError: true,
    });
    const [current] = data.groups;
    const runIds = data.groups.flatMap((group) =>
      group.runs.map((run) => run.runId),
    );

    expect(data.groups).toHaveLength(4);
    expect(current?.pullRequest?.url).toBe(
      'https://github.com/acme/config/pull/58',
    );
    expect(runIds).toEqual(
      expect.arrayContaining([
        'run_billing_1',
        'run_postgres_2',
        'run_search_2',
      ]),
    );
    expect(runIds).not.toContain('run_retries_3');
    expect(data.inForce?.tally.runs).toBe(current?.runs.length);
  });

  it('gives other stations lighter history of their own', async () => {
    const { data } = await listStationOutcomes({
      path: TRIAGE,
      throwOnError: true,
    });
    const runIds = data.groups.flatMap((group) =>
      group.runs.map((run) => run.runId),
    );

    expect(runIds).toEqual(
      expect.arrayContaining(['run_retries_1', 'run_rate_limits_1']),
    );
    expect(runIds).not.toContain('run_checkout_1');
  });

  it('reads the judge’s agreement with people', async () => {
    const { data: judged } = await readStationJudge({
      path: IMPLEMENTATION,
      throwOnError: true,
    });
    const { data: unjudged } = await readStationJudge({
      path: TRIAGE,
      throwOnError: true,
    });

    expect(judged.calibration.trusted).toBe(true);
    expect(judged.versions[0]?.current).toBe(true);
    expect(unjudged.calibration.hiddenBecause).toBe('no-judge');
  });

  it('lists the station’s replay sets and the team’s', async () => {
    const { data: atStation } = await listReplaySets({
      path: IMPLEMENTATION,
      throwOnError: true,
    });
    const { data: onTeam } = await listTeamReplaySets({
      path: { teamId: PLATFORM_ID },
      throwOnError: true,
    });

    expect(atStation.map((set) => [set.id, set.entries.length])).toEqual([
      ['set_billing_work', 7],
      ['set_docs', 2],
    ]);
    expect(onTeam.map((set) => set.id)).toEqual(
      expect.arrayContaining([
        'set_billing_work',
        'set_docs',
        'set_triage_billing',
        'set_review_money',
        'set_incident_data',
      ]),
    );
    expect(onTeam.map((set) => set.id)).not.toContain('set_experiment_pricing');
  });

  it('lists the replays of a set, one of them running', async () => {
    const { data: billing } = await listReplays({
      path: { teamId: PLATFORM_ID, setId: 'set_billing_work' },
      throwOnError: true,
    });
    const { data: docs } = await listReplays({
      path: { teamId: PLATFORM_ID, setId: 'set_docs' },
      throwOnError: true,
    });

    expect(billing.filter((each) => each.state === 'running')).toHaveLength(1);
    expect(billing.filter((each) => each.isBaseline)).toHaveLength(1);
    expect(docs).toEqual([]);
  });

  it('reads a replay compared with its baseline, with its runs', async () => {
    const { data: replay } = await readReplay({
      path: { teamId: PLATFORM_ID, replayId: 'replay_shorter_prompt' },
      throwOnError: true,
    });
    const runId = replay.entries[0]?.runId ?? '';
    const { data: run } = await readReplayRun({
      path: { teamId: PLATFORM_ID, runId },
      throwOnError: true,
    });
    const { data: of } = await readReplayOfRun({
      path: { teamId: PLATFORM_ID, runId },
      throwOnError: true,
    });

    expect(replay.comparedWith).toMatchObject({
      replayId: 'replay_live_4',
      successRate: expect.any(Number),
    });
    expect(replay.comparison).toHaveLength(7);
    expect(run.original.title).toBe('Fix the flaky billing test');
    expect(of.setName).toBe('Billing work');
  });

  it('answers the set’s checks, suggestions and the station’s replayable runs', async () => {
    const set = { teamId: PLATFORM_ID, setId: 'set_billing_work' };
    const { data: checks } = await listReplaySetChecks({
      path: set,
      query: { limit: 2 },
      throwOnError: true,
    });
    const { data: suggestions } = await listReplaySetSuggestions({
      path: set,
      throwOnError: true,
    });
    const { data: replayable } = await listReplayableRuns({
      path: IMPLEMENTATION,
      throwOnError: true,
    });

    expect(checks.map((each) => each.verdict)).toEqual(['running', 'passed']);
    expect(suggestions.map((each) => each.runId)).toContain('run_billing_1');
    expect(
      replayable.some((each) => each.unreplayableReason === 'archive-gone'),
    ).toBe(true);
  });

  it('lists the replay candidates at the station’s address', async () => {
    const { data } = await listReplayCandidates({
      path: { workspaceId: WORKSPACE.id },
      query: { station: 'platform/delivery/implementation' },
      throwOnError: true,
    });

    expect(data.items.map((each) => each.name)).toContain('Shorter prompt');
  });

  it('lists the searches and reads the finished one', async () => {
    const { data: searches } = await listSearches({
      path: IMPLEMENTATION,
      throwOnError: true,
    });
    const { data: search } = await readSearch({
      path: { teamId: PLATFORM_ID, searchId: 'search_tests_first' },
      throwOnError: true,
    });
    const { data: run } = await readSearchRun({
      path: { teamId: PLATFORM_ID, runId: search.iterations[0]?.runId ?? '' },
      throwOnError: true,
    });

    expect(searches.map((each) => [each.id, each.state])).toEqual([
      ['search_tests_first', 'finished'],
      ['search_live', 'stopped'],
    ]);
    expect(search.best?.name).toBe('tests-first');
    expect(search.best?.onlyOnSeenTasks).toBe('marked');
    expect(search.split.searchedTasks + search.split.heldOutTasks).toBe(7);
    expect(run.searchId).toBe('search_tests_first');
  });

  it('reads the replayed candidates for Insights', async () => {
    const { data } = await readReplayedCandidates({
      path: { teamId: PLATFORM_ID },
      query: { period: '30d' },
      throwOnError: true,
    });
    const [billing] = data.stations[0]?.sets ?? [];

    expect(billing?.setId).toBe('set_billing_work');
    expect(billing?.baseline?.replayId).toBe('replay_live_4');
    expect(billing?.candidates.map((each) => each.name)).toContain(
      'tests-first',
    );
  });

  it('opens a set, adds a run and replays it', async () => {
    const { data: opened } = await openReplaySet({
      path: IMPLEMENTATION,
      body: { name: 'Refund fixes' },
      throwOnError: true,
    });
    await addReplaySetEntry({
      path: { teamId: PLATFORM_ID, setId: opened.id },
      body: { runId: 'run_refunds_2' },
      throwOnError: true,
    });
    const { data: replay } = await startReplay({
      path: { teamId: PLATFORM_ID, setId: opened.id },
      body: { candidate: 'live', ceiling: { amount: 5, currency: 'USD' } },
      throwOnError: true,
    });
    const { data: replays } = await listReplays({
      path: { teamId: PLATFORM_ID, setId: opened.id },
      throwOnError: true,
    });

    expect(replays.map((each) => each.id)).toEqual([replay.id]);
  });

  it('picks a candidate and stops a search', async () => {
    const searchId = 'search_tests_first';
    const { data: picked } = await pickSearchCandidate({
      path: { teamId: PLATFORM_ID, searchId, candidateId: 'candidate_opus' },
      throwOnError: true,
    });
    await stopSearch({
      path: { teamId: PLATFORM_ID, searchId },
      throwOnError: true,
    });
    const { data: search } = await readSearch({
      path: { teamId: PLATFORM_ID, searchId },
      throwOnError: true,
    });

    expect(picked.state).toBe('opened');
    expect(search.state).toBe('stopped');
  });
});

describe('the mock station in an empty workspace', () => {
  serveMockApi('empty');

  it('answers empty', async () => {
    const { data: outcomes } = await listStationOutcomes({
      path: IMPLEMENTATION,
      throwOnError: true,
    });
    const { data: judge } = await readStationJudge({
      path: IMPLEMENTATION,
      throwOnError: true,
    });
    const { data: sets } = await listReplaySets({
      path: IMPLEMENTATION,
      throwOnError: true,
    });
    const { data: searches } = await listSearches({
      path: IMPLEMENTATION,
      throwOnError: true,
    });
    const { data: candidates } = await readReplayedCandidates({
      path: { teamId: PLATFORM_ID },
      query: { period: '30d' },
      throwOnError: true,
    });
    const { response } = await readSearch({
      path: { teamId: PLATFORM_ID, searchId: 'search_tests_first' },
    });

    expect(outcomes).toEqual({
      stationId: 'station_implementation',
      groups: [],
      inForce: null,
    });
    expect(judge.versions).toEqual([]);
    expect(sets).toEqual([]);
    expect(searches).toEqual([]);
    expect(candidates.stations).toEqual([]);
    expect(response?.status).toBe(404);
  });
});
