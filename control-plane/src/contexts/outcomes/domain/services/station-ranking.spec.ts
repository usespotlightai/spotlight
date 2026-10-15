import {
  day,
  failuresOf,
  historyOf,
} from '@outcomes/domain/insights.fake-spec';
import { costedRecord, endedRecord } from '@outcomes/domain/outcomes.fake-spec';
import { stationsWorthImprovingFrom } from '@outcomes/domain/services/station-ranking';
import {
  failingTasksOf,
  teamCountsOf,
} from '@outcomes/domain/services/station-reports';
import type { TeamHistory } from '@outcomes/domain/services/team-history';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { NextAct } from '@outcomes/domain/value-objects/next-act.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));

const stationsWorthImproving = (history: TeamHistory, period: InsightsPeriod) =>
  stationsWorthImprovingFrom(
    teamCountsOf(history, period),
    failingTasksOf(history, period.previous),
  );

const runsAt = (stationId: string, when: string, count: number, sentBack = 0) =>
  Array.from({ length: count }, (_, at) => {
    const ended = endedRecord(`${stationId}_${when}_${at}`, {
      stationId,
      taskId: `task_${stationId}_${at}`,
      endedAt: day(when, 8 + at),
    });

    return at < sentBack
      ? ended.actedOn(NextAct.of('sent-back', day(when, 20)))
      : ended;
  });

describe('stationsWorthImproving', () => {
  it('names a station whose sent-back rate rose against the period before, flagged once it is 5 points worse', () => {
    const history = historyOf({
      records: [
        ...runsAt('station_1', '2026-09-20', 4, 0),
        ...runsAt('station_1', '2026-09-28', 4, 2),
        ...runsAt('station_2', '2026-09-28', 4, 2),
        ...runsAt('station_2', '2026-09-20', 4, 2),
      ],
    });

    const [worst, ...rest] = stationsWorthImproving(history, PERIOD);

    expect(worst).toMatchObject({
      lineId: 'line_1',
      stationId: 'station_1',
      runs: 4,
      signals: [
        {
          signal: 'sent-back',
          now: 0.5,
          before: 0,
          team: 0.5,
          rose: true,
          trails: false,
          flaggedAbove: 0.05,
          currency: null,
        },
      ],
      mixedCurrencies: false,
    });
    expect(rest).toEqual([]);
  });

  it('names a station that trails the team, the one with more signals first', () => {
    const history = historyOf({
      records: [
        ...runsAt('station_1', '2026-09-28', 3, 3),
        ...runsAt('station_2', '2026-09-28', 3, 0),
        ...runsAt('station_3', '2026-09-28', 6, 0),
        costedRecord('costly_1', {
          stationId: 'station_2',
          endedAt: day('2026-09-29'),
          amount: 30,
        }),
      ],
      failures: [
        failuresOf('task_station_2_0', [
          { stationId: 'station_2', at: day('2026-09-28', 9) },
          { stationId: 'station_2', occurrences: 2, at: day('2026-09-28', 10) },
        ]),
      ],
    });

    const ranked = stationsWorthImproving(history, PERIOD);

    expect(
      ranked.map((each) => [
        each.stationId,
        each.signals.map((signal) => signal.signal),
      ]),
    ).toEqual([
      ['station_2', ['task-failures', 'cost']],
      ['station_1', ['sent-back']],
    ]);
  });

  it('compares a station’s task failures with its own in the period before', () => {
    const history = historyOf({
      records: [
        ...runsAt('station_1', '2026-09-20', 4, 0),
        ...runsAt('station_1', '2026-09-28', 4, 0),
        ...runsAt('station_2', '2026-09-20', 4, 0),
        ...runsAt('station_2', '2026-09-28', 4, 0),
      ],
      failures: [
        failuresOf('task_steady', [
          { stationId: 'station_1', at: day('2026-09-20', 9) },
          { stationId: 'station_1', at: day('2026-09-20', 10) },
          { stationId: 'station_1', at: day('2026-09-28', 9) },
          { stationId: 'station_1', at: day('2026-09-28', 10) },
        ]),
        failuresOf('task_new', [
          { stationId: 'station_2', at: day('2026-09-28', 9) },
          { stationId: 'station_2', at: day('2026-09-28', 10) },
        ]),
      ],
    });

    const ranked = stationsWorthImproving(history, PERIOD);

    expect(
      ranked.map((each) => [
        each.stationId,
        each.signals.map((signal) => [signal.signal, signal.rose]),
      ]),
    ).toEqual([['station_2', [['task-failures', true]]]]);
  });

  it('says a station’s cost could not be read when its priced runs span several currencies', () => {
    const history = historyOf({
      records: [
        ...runsAt('station_1', '2026-09-28', 3, 3),
        costedRecord('usd_1', {
          stationId: 'station_1',
          endedAt: day('2026-09-29'),
          amount: 1,
        }),
        costedRecord('eur_1', {
          stationId: 'station_1',
          endedAt: day('2026-09-29', 13),
          amount: 1,
          currency: 'EUR',
        }),
        ...runsAt('station_2', '2026-09-28', 3, 0),
      ],
    });

    const [worst] = stationsWorthImproving(history, PERIOD);

    expect(worst?.stationId).toBe('station_1');
    expect(worst?.mixedCurrencies).toBe(true);
    expect(worst?.signals.map((each) => each.signal)).not.toContain('cost');
  });

  it('says the currency of a cost signal, compares cost only with spend in that same currency, and flags it a quarter above the team', () => {
    const history = historyOf({
      records: [
        ...runsAt('station_1', '2026-09-28', 3, 0),
        costedRecord('costly_1', {
          stationId: 'station_1',
          endedAt: day('2026-09-29'),
          amount: 30,
          currency: 'EUR',
        }),
        ...runsAt('station_1', '2026-09-20', 3, 0),
        costedRecord('cheap_1', {
          stationId: 'station_1',
          endedAt: day('2026-09-21'),
          amount: 1,
        }),
        ...runsAt('station_2', '2026-09-28', 3, 0),
        costedRecord('cheap_2', {
          stationId: 'station_2',
          endedAt: day('2026-09-29'),
          amount: 1,
          currency: 'EUR',
        }),
      ],
    });

    const [worst] = stationsWorthImproving(history, PERIOD);
    const cost = worst?.signals.find((each) => each.signal === 'cost');

    expect(worst?.stationId).toBe('station_1');
    expect(cost).toMatchObject({
      currency: 'EUR',
      before: null,
      rose: false,
      trails: true,
    });
    expect(cost?.flaggedAbove).toBeCloseTo((cost?.team ?? 0) * 1.25);
  });

  it('passes over a station with too few runs to tell', () => {
    const history = historyOf({
      records: [
        ...runsAt('station_1', '2026-09-28', 2, 2),
        ...runsAt('station_2', '2026-09-28', 5, 0),
      ],
    });

    expect(stationsWorthImproving(history, PERIOD)).toEqual([]);
  });
});
