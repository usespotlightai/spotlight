import { day, historyOf } from '@outcomes/domain/insights.fake-spec';
import { costedRecord, endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import {
  costBreakdownFrom,
  costCountsOf,
} from '@outcomes/domain/services/cost-breakdown';
import type { TeamHistory } from '@outcomes/domain/services/team-history';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { RunCost } from '@outcomes/domain/value-objects/run-cost.vo';
import { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));

const tokened = (
  runId: string,
  stationId: string,
  input: number | null,
  cacheRead: number | null,
  cacheWrite: number | null = null,
) =>
  endedRecord(runId, { stationId, endedAt: day('2026-09-28') }).digested(
    RunCost.of({
      ms: 1_000,
      steps: 1,
      faults: 0,
      changedLines: 0,
      used: null,
      size: null,
      amount: null,
      currency: null,
      tokens: { input, output: 10, cacheRead, cacheWrite },
    }),
    RunTools.NONE,
  );

const costBreakdownOf = (history: TeamHistory, window: Window) =>
  costBreakdownFrom(costCountsOf(history, window));

describe('costBreakdownFrom the counts of costCountsOf', () => {
  it('shares out cache reads among the input the runs read, leaving out runs whose counts are unknown', () => {
    const history = historyOf({
      records: [
        tokened('run_1', 'station_1', 100, 300),
        tokened('run_2', 'station_1', 100, null),
        tokened('run_3', 'station_2', null, null),
      ],
    });

    const cost = costBreakdownOf(history, PERIOD.current);

    expect(cost.cache).toEqual({
      input: 100,
      cacheRead: 300,
      cacheWrite: null,
      cacheShare: 0.75,
    });
    expect(cost.cacheByStation).toEqual([
      {
        stationId: 'station_1',
        input: 100,
        cacheRead: 300,
        cacheWrite: null,
        cacheShare: 0.75,
      },
      {
        stationId: 'station_2',
        input: null,
        cacheRead: null,
        cacheWrite: null,
        cacheShare: null,
      },
    ]);
  });

  it('counts the tokens written to cache among all the runs read, not as cache reads', () => {
    const history = historyOf({
      records: [
        tokened('run_1', 'station_1', 100, 300, 100),
        tokened('run_2', 'station_1', 100, 300),
      ],
    });

    expect(costBreakdownOf(history, PERIOD.current).cache).toEqual({
      input: 200,
      cacheRead: 600,
      cacheWrite: 100,
      cacheShare: 600 / 900,
    });
  });

  it('splits spend by harness, model, station and repository', () => {
    const history = historyOf({
      records: [
        costedRecord('run_1', {
          endedAt: day('2026-09-28'),
          model: 'sonnet',
          repositories: ['acme/api', 'acme/web'],
          amount: 2,
        }),
        costedRecord('run_2', {
          endedAt: day('2026-09-29'),
          stationId: 'station_2',
          harness: 'codex',
          model: null,
          repositories: [],
          amount: 1,
        }),
        endedRecord('run_3', { endedAt: day('2026-09-29') }),
        costedRecord('run_4', { endedAt: day('2026-09-20'), amount: 40 }),
      ],
    });

    const cost = costBreakdownOf(history, PERIOD.current);

    expect(cost.spend).toEqual({ amount: 3, currency: 'USD' });
    expect(cost.unpriced).toBe(1);
    expect(cost.mixedCurrencies).toBe(false);
    expect(cost.byHarness).toEqual([
      { key: 'claude-code', amount: 2, runs: 1 },
      { key: 'codex', amount: 1, runs: 1 },
    ]);
    expect(cost.byModel).toEqual([
      { key: 'sonnet', amount: 2, runs: 1 },
      { key: null, amount: 1, runs: 1 },
    ]);
    expect(cost.byStation.map((each) => each.key)).toEqual([
      'station_1',
      'station_2',
    ]);
    expect(cost.byRepository).toEqual([
      { key: 'acme/api', amount: 1, runs: 1 },
      { key: 'acme/web', amount: 1, runs: 1 },
      { key: null, amount: 1, runs: 1 },
    ]);
  });

  it('breaks nothing down when the priced runs span several currencies, counting as unpriced only runs with no price', () => {
    const history = historyOf({
      records: [
        costedRecord('run_1', { endedAt: day('2026-09-28'), amount: 2 }),
        costedRecord('run_2', {
          endedAt: day('2026-09-29'),
          amount: 1,
          currency: 'EUR',
        }),
        endedRecord('run_3', { endedAt: day('2026-09-29') }),
      ],
    });

    const cost = costBreakdownOf(history, PERIOD.current);

    expect(cost.spend).toBeNull();
    expect(cost.mixedCurrencies).toBe(true);
    expect(cost.unpriced).toBe(1);
    expect(cost.byModel).toEqual([]);
    expect(cost.links).toEqual([]);
  });

  it('lays spend out from model to station to repository', () => {
    const history = historyOf({
      records: [
        costedRecord('run_1', {
          endedAt: day('2026-09-28'),
          model: 'sonnet',
          repositories: ['acme/api', 'acme/web'],
          amount: 2,
        }),
        costedRecord('run_2', {
          endedAt: day('2026-09-28'),
          model: 'sonnet',
          repositories: ['acme/api'],
          amount: 1,
        }),
      ],
    });

    const { nodes, links } = costBreakdownOf(history, PERIOD.current);

    expect(nodes.map((each) => each.id)).toEqual([
      'model:sonnet',
      'station:station_1',
      'repository:acme/api',
      'repository:acme/web',
    ]);
    expect(links).toEqual([
      { source: 'model:sonnet', target: 'station:station_1', amount: 3 },
      { source: 'station:station_1', target: 'repository:acme/api', amount: 2 },
      { source: 'station:station_1', target: 'repository:acme/web', amount: 1 },
    ]);
  });

  it('splits nothing when prices came in more than one currency', () => {
    const history = historyOf({
      records: [
        costedRecord('run_1', { endedAt: day('2026-09-28'), currency: 'USD' }),
        costedRecord('run_2', { endedAt: day('2026-09-28'), currency: 'EUR' }),
      ],
    });

    expect(costBreakdownOf(history, PERIOD.current)).toMatchObject({
      spend: null,
      byModel: [],
      links: [],
    });
  });
});
