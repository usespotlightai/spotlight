import { describe, expect, it } from 'vitest';
import {
  listInsightsPullRequests,
  listInsightsRuns,
  readInsightsChanges,
  readInsightsCost,
  readInsightsFlow,
  readInsightsMemory,
  readInsightsOverview,
  readInsightsPeople,
  readInsightsPullRequests,
  readInsightsSetups,
  readInsightsShipping,
  readInsightsStations,
  readInsightsTools,
} from '@/lib/api';
import { serveMockApi } from '@/mocks/testing';
import { PLATFORM_ID } from '@/mocks/world';
import { FINGERPRINTS } from '@/mocks/world/station-history';

const team = { teamId: PLATFORM_ID };

const IMPLEMENTATION = 'station_implementation';

describe('the mock insights', () => {
  serveMockApi();

  it('flags only Implementation as worth improving, for its sent-back rate and cost', async () => {
    const { data } = await readInsightsOverview({
      path: team,
      query: { period: '30d' },
      throwOnError: true,
    });

    expect(data.worthImproving.map((each) => each.stationId)).toEqual([
      IMPLEMENTATION,
    ]);
    expect(
      data.worthImproving[0]?.signals.map((each) => each.signal).sort(),
    ).toEqual(['cost', 'sent-back']);
    expect(data.worthImproving[0]?.signals.every((each) => each.rose)).toBe(
      true,
    );
    expect(data.output).toHaveLength(30);
  });

  it('answers a shorter period with smaller totals', async () => {
    const read = async (period: '7d' | '30d' | '90d') =>
      (
        await readInsightsOverview({
          path: team,
          query: { period },
          throwOnError: true,
        })
      ).data.headline.runs;

    const [week, month, quarter] = await Promise.all([
      read('7d'),
      read('30d'),
      read('90d'),
    ]);

    expect(week).toBeGreaterThan(0);
    expect(week).toBeLessThan(month);
    expect(month).toBeLessThan(quarter);
  });

  it('counts the same runs on the overview, the stations and the runs list', async () => {
    const query = { period: '30d' as const };
    const [overview, stations, runs, cost] = await Promise.all([
      readInsightsOverview({ path: team, query, throwOnError: true }),
      readInsightsStations({ path: team, query, throwOnError: true }),
      listInsightsRuns({ path: team, query, throwOnError: true }),
      readInsightsCost({ path: team, query, throwOnError: true }),
    ]);

    expect(stations.data.team.runs).toBe(overview.data.headline.runs);
    expect(runs.data.total).toBe(overview.data.headline.runs);
    expect(cost.data.cost.spend).toEqual(overview.data.headline.spend);
    expect(runs.data.runs).toHaveLength(50);
  });

  it('filters the runs list by station and outcome', async () => {
    const { data } = await listInsightsRuns({
      path: team,
      query: { period: '30d', stationId: IMPLEMENTATION, outcome: 'failed' },
      throwOnError: true,
    });
    const { data: stations } = await readInsightsStations({
      path: team,
      query: { period: '30d' },
      throwOnError: true,
    });

    expect(data.runs.every((run) => run.stationId === IMPLEMENTATION)).toBe(
      true,
    );
    expect(data.total).toBe(
      stations.stations.find((each) => each.stationId === IMPLEMENTATION)?.tally
        .failed,
    );
  });

  it('answers the flow, people and cost of the period', async () => {
    const query = { period: '30d' as const };
    const [flow, people, cost] = await Promise.all([
      readInsightsFlow({ path: team, query, throwOnError: true }),
      readInsightsPeople({ path: team, query, throwOnError: true }),
      readInsightsCost({ path: team, query, throwOnError: true }),
    ]);

    expect(flow.data.flow.stations.map((each) => each.stationId)).toContain(
      IMPLEMENTATION,
    );
    expect(flow.data.flow.delivery.merged).toBeGreaterThan(0);
    expect(people.data.load.unanswered).toBe(2);
    expect(people.data.adoption.people.map((each) => each.name).sort()).toEqual(
      ['Maya Chen', 'Priya Nair', 'Sam Rivera', 'Tom Becker'],
    );
    expect(cost.data.cost.byHarness.map((each) => each.key).sort()).toEqual([
      'claude-code',
      'codex',
    ]);
    expect(cost.data.cost.byStation[0]?.key).toBe(IMPLEMENTATION);
  });

  it('marks the tests-first version of Implementation among the config changes', async () => {
    const { data } = await readInsightsChanges({
      path: team,
      query: { period: '30d' },
      throwOnError: true,
    });

    expect(data.markers[0]?.stationId).toBe(IMPLEMENTATION);
    expect(data.markers[0]?.fingerprint).toBe(FINGERPRINTS.tests);
    expect(data.markers.map((each) => each.fingerprint)).toContain(
      FINGERPRINTS.effort,
    );
    expect(data.judges[0]?.stationId).toBe(IMPLEMENTATION);
  });

  it('compares setups, with the judge only at one station', async () => {
    const [team_, station] = await Promise.all([
      readInsightsSetups({
        path: team,
        query: { period: '30d' },
        throwOnError: true,
      }),
      readInsightsSetups({
        path: team,
        query: { period: '30d', stationId: IMPLEMENTATION },
        throwOnError: true,
      }),
    ]);

    expect(team_.data.judgeWithheld).toBe('no_station');
    expect(team_.data.setups.map((each) => each.harness)).toContain('codex');
    expect(station.data.setups.map((each) => each.effort).sort()).toEqual([
      'high',
      'medium',
    ]);
    expect(station.data.judges).toHaveLength(1);
  });

  it('answers the tools and memory of the period', async () => {
    const query = { period: '30d' as const };
    const [tools, memory] = await Promise.all([
      readInsightsTools({ path: team, query, throwOnError: true }),
      readInsightsMemory({ path: team, query, throwOnError: true }),
    ]);

    expect(tools.data.skills.map((each) => each.key)).toContain(
      'grafana-dashboards',
    );
    expect(tools.data.servers.map((each) => each.server).sort()).toEqual([
      'linear',
      'sentry',
      'slack',
    ]);
    expect(memory.data.runsBriefed).toBeGreaterThan(0);
    expect(memory.data.withoutMemories.runs).toBeGreaterThan(0);
    expect(memory.data.flagged.map((each) => each.memoryId)).toEqual([
      'memory_flaky',
    ]);
  });

  it('answers the pull requests and their list from the same repositories', async () => {
    const query = { period: '30d' as const };
    const [summary, list, overview] = await Promise.all([
      readInsightsPullRequests({ path: team, query, throwOnError: true }),
      listInsightsPullRequests({
        path: team,
        query: { ...query, author: 'spotlight', state: 'merged' },
        throwOnError: true,
      }),
      readInsightsOverview({ path: team, query, throwOnError: true }),
    ]);

    expect(summary.data.repositories).toEqual(['acme/api', 'acme/worker']);
    expect(summary.data.penetration.made).toBe(
      overview.data.headline.mergedPullRequests,
    );
    expect(list.data.total).toBe(summary.data.penetration.made);
    expect(
      list.data.pullRequests.every((each) => each.by === 'spotlight'),
    ).toBe(true);
  });

  it('keeps the world’s own pull requests at their numbers', async () => {
    const { data } = await listInsightsPullRequests({
      path: team,
      query: { period: '30d', size: 200 },
      throwOnError: true,
    });
    const numbers = data.pullRequests
      .filter((each) => each.repository === 'acme/api')
      .map((each) => each.number);

    expect(numbers).toContain(412);
    expect(numbers).toContain(431);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('answers what the agents ship', async () => {
    const { data } = await readInsightsShipping({
      path: team,
      query: { period: '30d' },
      throwOnError: true,
    });

    expect(data.shippedAny).toBe(true);
    expect(data.mergeDays).toHaveLength(30);
    expect(
      data.pipeline.layouts.stations.map((each) => each.stationId),
    ).toContain(IMPLEMENTATION);
  });
});

describe('the mock insights of a fresh workspace', () => {
  serveMockApi('empty');

  it('answers every tab empty', async () => {
    const query = { period: '30d' as const };
    const [overview, stations, runs, changes, pullRequests, list, shipping] =
      await Promise.all([
        readInsightsOverview({ path: team, query, throwOnError: true }),
        readInsightsStations({ path: team, query, throwOnError: true }),
        listInsightsRuns({ path: team, query, throwOnError: true }),
        readInsightsChanges({ path: team, query, throwOnError: true }),
        readInsightsPullRequests({ path: team, query, throwOnError: true }),
        listInsightsPullRequests({ path: team, query, throwOnError: true }),
        readInsightsShipping({ path: team, query, throwOnError: true }),
      ]);

    expect(overview.data.headline.runs).toBe(0);
    expect(overview.data.worthImproving).toEqual([]);
    expect(stations.data.stations).toEqual([]);
    expect(runs.data.runs).toEqual([]);
    expect(changes.data.markers).toEqual([]);
    expect(pullRequests.data.total).toBe(0);
    expect(list.data.pullRequests).toEqual([]);
    expect(shipping.data.shippedAny).toBe(false);
  });

  it('answers the other tabs with their zero shape', async () => {
    const query = { period: '30d' as const };
    const [cost, flow, people, tools, memory, setups] = await Promise.all([
      readInsightsCost({ path: team, query, throwOnError: true }),
      readInsightsFlow({ path: team, query, throwOnError: true }),
      readInsightsPeople({ path: team, query, throwOnError: true }),
      readInsightsTools({ path: team, query, throwOnError: true }),
      readInsightsMemory({ path: team, query, throwOnError: true }),
      readInsightsSetups({ path: team, query, throwOnError: true }),
    ]);

    expect(cost.data.cost.spend).toBeNull();
    expect(flow.data.flow.stations).toEqual([]);
    expect(people.data.adoption.people).toEqual([]);
    expect(tools.data.skills).toEqual([]);
    expect(memory.data.standing).toBe(0);
    expect(setups.data.setups).toEqual([]);
  });
});
