import { describe, expect, it } from 'vitest';
import {
  readReplayedCandidates,
  readStationInsights,
  readStationJudge,
} from '@/lib/api';
import { serveMockApi } from '@/mocks/testing';
import { DELIVERY_ID, PLATFORM_ID } from '@/mocks/world';

const IMPLEMENTATION = {
  teamId: PLATFORM_ID,
  lineId: DELIVERY_ID,
  stationId: 'station_implementation',
};

const TRIAGE = { ...IMPLEMENTATION, stationId: 'station_triage' };

describe('the mock station', () => {
  serveMockApi();

  it('groups the implementation runs by config version, newest from the tests-first pull request', async () => {
    const { data } = await readStationInsights({
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
    const { data } = await readStationInsights({
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

    expect(judged.calibration.qualified).toBe(true);
    expect(judged.versions[0]?.current).toBe(true);
    expect(unjudged.calibration.hiddenReason).toBe('no-judge');
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
});

describe('the mock station in an empty workspace', () => {
  serveMockApi('empty');

  it('answers empty', async () => {
    const { data: outcomes } = await readStationInsights({
      path: IMPLEMENTATION,
      throwOnError: true,
    });
    const { data: judge } = await readStationJudge({
      path: IMPLEMENTATION,
      throwOnError: true,
    });
    const { data: candidates } = await readReplayedCandidates({
      path: { teamId: PLATFORM_ID },
      query: { period: '30d' },
      throwOnError: true,
    });

    expect(outcomes).toEqual({
      stationId: 'station_implementation',
      groups: [],
      inForce: null,
    });
    expect(judge.versions).toEqual([]);
    expect(candidates.stations).toEqual([]);
  });
});
