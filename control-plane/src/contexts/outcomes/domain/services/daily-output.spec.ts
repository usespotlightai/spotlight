import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import {
  day,
  deliveredOf,
  historyOf,
} from '@outcomes/domain/insights.fake-spec';
import {
  costedRecord,
  endedRecord,
  FIRST_CONFIG,
  SECOND_CONFIG,
} from '@outcomes/domain/outcomes.fake-spec';
import {
  type ConfigMarker,
  configMarkersAlong,
  configMarkersOf,
  dailyOutputFrom,
  daySpendingOf,
  outputCurrencyOf,
} from '@outcomes/domain/services/daily-output';
import { resolvedDeliveriesOf } from '@outcomes/domain/services/headline';
import {
  openingsOf,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));

const dailyOutputOf = (
  history: TeamHistory,
  period: InsightsPeriod,
  markers: readonly ConfigMarker[],
) =>
  dailyOutputFrom(
    daySpendingOf(history, period),
    resolvedDeliveriesOf(history, openingsOf(history.touches)),
    period,
    markers,
  );

const carriedOn = (lastRuns: readonly RunRecord[] = []) => ({
  from: PERIOD.lookback.from,
  lastRuns,
});

describe('dailyOutputOf', () => {
  it('lays spend and merges out per day of the period', () => {
    const output = dailyOutputOf(
      historyOf({
        records: [
          costedRecord('run_1', { endedAt: day('2026-09-26', 9), amount: 1 }),
          costedRecord('run_2', { endedAt: day('2026-09-26', 17), amount: 2 }),
        ],
        deliveries: [
          deliveredOf('task_1', {
            openedAt: day('2026-09-26'),
            closedAt: day('2026-09-27'),
          }),
        ],
      }),
      PERIOD,
      [],
    );

    expect(output).toHaveLength(7);
    expect(output[1]).toEqual({
      day: '2026-09-26',
      runs: 2,
      spend: { amount: 3, currency: 'USD' },
      unpriced: 0,
      mixedCurrencies: false,
      merged: 0,
      mergedTaskIds: [],
      changes: [],
    });
    expect(output[2]).toMatchObject({
      day: '2026-09-27',
      runs: 0,
      spend: null,
      merged: 1,
      mergedTaskIds: ['task_1'],
    });
  });
});

describe('dailyOutputOf, with config changes', () => {
  it('puts each config change on the UTC day its first run started', () => {
    const marker = {
      lineId: 'line_1',
      stationId: 'station_1',
      fingerprint: SECOND_CONFIG,
      previousFingerprint: FIRST_CONFIG,
      firstRunAt: new Date('2026-09-27T23:30:00.000Z'),
      runId: 'run_2',
    };

    const output = dailyOutputOf(historyOf({}), PERIOD, [marker]);

    expect(
      output.map((each) => [each.day, each.changes.length]),
    ).toContainEqual(['2026-09-27', 1]);
    expect(output.flatMap((each) => each.changes)).toEqual([marker]);
  });
});

describe('dailyOutputOf, priced in several currencies', () => {
  it('sums no spend for a day whose runs were priced in several currencies, saying so', () => {
    const [, mixed] = dailyOutputOf(
      historyOf({
        records: [
          costedRecord('run_1', { endedAt: day('2026-09-26', 9), amount: 1 }),
          costedRecord('run_2', {
            endedAt: day('2026-09-26', 17),
            amount: 2,
            currency: 'EUR',
          }),
        ],
      }),
      PERIOD,
      [],
    );

    expect(mixed).toMatchObject({
      day: '2026-09-26',
      runs: 2,
      spend: null,
      unpriced: 0,
      mixedCurrencies: true,
    });
  });
});

describe('outputCurrencyOf', () => {
  const ranIn = (...currencies: string[]) =>
    dailyOutputOf(
      historyOf({
        records: currencies.map((currency, at) =>
          costedRecord(`run_${at}`, {
            endedAt: day(`2026-09-2${6 + at}`, 9),
            amount: 1,
            currency,
          }),
        ),
      }),
      PERIOD,
      [],
    );

  it('names the one currency the period’s days were priced in', () => {
    expect(outputCurrencyOf(ranIn('USD', 'USD'))).toEqual({
      currency: 'USD',
      mixedCurrencies: false,
    });
  });

  it('names none when days were priced in different currencies, saying so', () => {
    expect(outputCurrencyOf(ranIn('USD', 'EUR'))).toEqual({
      currency: null,
      mixedCurrencies: true,
    });
  });

  it('names none when nothing was priced, without calling it mixed', () => {
    expect(outputCurrencyOf(ranIn())).toEqual({
      currency: null,
      mixedCurrencies: false,
    });
  });
});

const started = (
  runId: string,
  change: NonNullable<Parameters<typeof costedRecord>[1]>,
) => costedRecord(runId, { startedAt: change.endedAt, ...change });

describe('configMarkersOf', () => {
  it('marks where a station first ran with a new config in the period', () => {
    const markers = configMarkersOf(
      historyOf({
        records: [
          started('run_1', {
            endedAt: day('2026-09-20'),
            fingerprint: FIRST_CONFIG,
          }),
          started('run_2', {
            endedAt: day('2026-09-26'),
            fingerprint: FIRST_CONFIG,
          }),
          started('run_3', {
            endedAt: day('2026-09-27'),
            fingerprint: SECOND_CONFIG,
          }),
          started('run_4', {
            endedAt: day('2026-09-28'),
            fingerprint: SECOND_CONFIG,
          }),
          started('run_5', {
            endedAt: day('2026-09-26'),
            stationId: 'station_2',
            fingerprint: SECOND_CONFIG,
          }),
        ],
      }),
      PERIOD,
      carriedOn(),
    );

    expect(markers).toEqual([
      {
        lineId: 'line_1',
        stationId: 'station_1',
        fingerprint: SECOND_CONFIG,
        previousFingerprint: FIRST_CONFIG,
        firstRunAt: day('2026-09-27'),
        runId: 'run_3',
      },
    ]);
  });

  it('looks back over the runs that started in the lookback, so a long run ending in it does not make a run carrying on a config look like its first', () => {
    const markers = configMarkersOf(
      historyOf({
        records: [
          started('run_long', {
            startedAt: day('2026-08-25'),
            endedAt: day('2026-09-05'),
            fingerprint: SECOND_CONFIG,
          }),
          started('run_before', {
            startedAt: day('2026-08-28'),
            endedAt: day('2026-08-29'),
            fingerprint: FIRST_CONFIG,
          }),
          started('run_carrying_on', {
            startedAt: day('2026-09-27'),
            endedAt: day('2026-09-27', 13),
            fingerprint: FIRST_CONFIG,
          }),
        ],
      }),
      PERIOD,
      carriedOn(),
    );

    expect(markers).toEqual([]);
  });

  it('marks a return to a config the station ran before as a change too, naming the config it left', () => {
    const markers = configMarkersOf(
      historyOf({
        records: [
          started('run_1', {
            endedAt: day('2026-09-20'),
            fingerprint: FIRST_CONFIG,
          }),
          started('run_2', {
            endedAt: day('2026-09-26'),
            fingerprint: SECOND_CONFIG,
          }),
          started('run_3', {
            endedAt: day('2026-09-27'),
            fingerprint: FIRST_CONFIG,
          }),
        ],
      }),
      PERIOD,
      carriedOn(),
    );

    expect(
      markers.map((each) => [
        each.runId,
        each.previousFingerprint,
        each.fingerprint,
      ]),
    ).toEqual([
      ['run_2', FIRST_CONFIG, SECOND_CONFIG],
      ['run_3', SECOND_CONFIG, FIRST_CONFIG],
    ]);
  });

  it('dates a marker from when the first run with the new config started, ordering runs by their start', () => {
    const markers = configMarkersOf(
      historyOf({
        records: [
          started('run_1', {
            endedAt: day('2026-09-20'),
            fingerprint: FIRST_CONFIG,
          }),
          started('run_2', {
            startedAt: day('2026-09-26', 8),
            endedAt: day('2026-09-27', 20),
            fingerprint: SECOND_CONFIG,
          }),
          started('run_3', {
            startedAt: day('2026-09-27', 9),
            endedAt: day('2026-09-27', 10),
            fingerprint: SECOND_CONFIG,
          }),
        ],
      }),
      PERIOD,
      carriedOn(),
    );

    expect(markers).toMatchObject([
      { runId: 'run_2', firstRunAt: day('2026-09-26', 8) },
    ]);
  });
});

describe('configMarkersOf, carrying on from before the lookback', () => {
  const before = started('run_before', {
    endedAt: day('2026-08-10'),
    fingerprint: FIRST_CONFIG,
  });

  it('marks the first config run in the lookback when the last config run before it ran another config', () => {
    const markers = configMarkersOf(
      historyOf({
        records: [
          started('run_1', {
            endedAt: day('2026-09-27'),
            fingerprint: SECOND_CONFIG,
          }),
          started('run_2', {
            endedAt: day('2026-09-28'),
            fingerprint: SECOND_CONFIG,
          }),
        ],
      }),
      PERIOD,
      carriedOn([before]),
    );

    expect(markers).toEqual([
      {
        lineId: 'line_1',
        stationId: 'station_1',
        fingerprint: SECOND_CONFIG,
        previousFingerprint: FIRST_CONFIG,
        firstRunAt: day('2026-09-27'),
        runId: 'run_1',
      },
    ]);
  });

  it('marks nothing where the first config run in the lookback carries on the config run before it', () => {
    expect(
      configMarkersOf(
        historyOf({
          records: [
            started('run_1', {
              endedAt: day('2026-09-27'),
              fingerprint: FIRST_CONFIG,
            }),
          ],
        }),
        PERIOD,
        carriedOn([before]),
      ),
    ).toEqual([]);
  });

  it('carries on from where the history it has starts in full, passing over runs from before then', () => {
    expect(
      configMarkersOf(
        historyOf({
          records: [
            started('run_early', {
              endedAt: day('2026-09-20'),
              fingerprint: FIRST_CONFIG,
            }),
            started('run_1', {
              endedAt: day('2026-09-27'),
              fingerprint: SECOND_CONFIG,
            }),
          ],
        }),
        PERIOD,
        {
          from: day('2026-09-25'),
          lastRuns: [
            started('run_carried', {
              endedAt: day('2026-09-24'),
              fingerprint: SECOND_CONFIG,
            }),
          ],
        },
      ),
    ).toEqual([]);
  });

  it('leaves the first config run ever at a station unmarked', () => {
    expect(
      configMarkersOf(
        historyOf({
          records: [
            started('run_1', {
              endedAt: day('2026-09-27'),
              fingerprint: SECOND_CONFIG,
            }),
          ],
        }),
        PERIOD,
        carriedOn([
          started('run_elsewhere', {
            endedAt: day('2026-08-10'),
            stationId: 'station_2',
            fingerprint: FIRST_CONFIG,
          }),
        ]),
      ),
    ).toEqual([]);
  });
});

describe('configMarkersAlong', () => {
  it('marks every run whose previous config run at the station ran another config, but not the first there', () => {
    const ranAt = (runId: string, hour: number, fingerprint: string) =>
      endedRecord(runId, {
        fingerprint,
        startedAt: day('2026-09-28', hour),
        endedAt: day('2026-09-28', hour),
      });

    expect(
      configMarkersAlong([
        ranAt('run_1', 1, FIRST_CONFIG),
        ranAt('run_2', 2, SECOND_CONFIG),
        ranAt('run_3', 3, SECOND_CONFIG),
        ranAt('run_4', 4, FIRST_CONFIG),
        ranAt('run_5', 5, SECOND_CONFIG),
      ]).map((each) => [each.runId, each.previousFingerprint]),
    ).toEqual([
      ['run_2', FIRST_CONFIG],
      ['run_4', SECOND_CONFIG],
      ['run_5', FIRST_CONFIG],
    ]);
  });

  it('starts no change at a cancelled run', () => {
    expect(
      configMarkersAlong([
        endedRecord('run_1', {
          fingerprint: FIRST_CONFIG,
          startedAt: day('2026-09-28', 9),
          endedAt: day('2026-09-28', 9),
        }),
        endedRecord('run_2', {
          fingerprint: SECOND_CONFIG,
          ending: 'cancelled',
          endedAt: day('2026-09-28', 10),
        }),
        endedRecord('run_3', {
          fingerprint: SECOND_CONFIG,
          startedAt: day('2026-09-28', 11),
          endedAt: day('2026-09-28', 11),
        }),
      ]),
    ).toMatchObject([{ runId: 'run_3', firstRunAt: day('2026-09-28', 11) }]);
  });

  it('starts no change at a run that failed before it started, between two runs of the config before', () => {
    expect(
      configMarkersAlong([
        endedRecord('run_1', {
          fingerprint: FIRST_CONFIG,
          startedAt: day('2026-09-28', 9),
          endedAt: day('2026-09-28', 9),
        }),
        endedRecord('run_2', {
          fingerprint: SECOND_CONFIG,
          ending: 'failed',
          endedAt: day('2026-09-28', 10),
        }),
        endedRecord('run_3', {
          fingerprint: FIRST_CONFIG,
          startedAt: day('2026-09-28', 11),
          endedAt: day('2026-09-28', 11),
        }),
      ]),
    ).toEqual([]);
  });

  it('orders runs that began at the same instant by run, whatever order they come in', () => {
    const at = day('2026-09-28', 9);
    const records = [
      endedRecord('run_b', {
        fingerprint: SECOND_CONFIG,
        startedAt: at,
        endedAt: day('2026-09-28', 10),
      }),
      endedRecord('run_a', {
        fingerprint: FIRST_CONFIG,
        startedAt: at,
        endedAt: day('2026-09-28', 10),
      }),
    ];

    expect(configMarkersAlong(records)).toMatchObject([
      { runId: 'run_b', fingerprint: SECOND_CONFIG, firstRunAt: at },
    ]);
    expect(configMarkersAlong([...records].reverse())).toMatchObject([
      { runId: 'run_b', fingerprint: SECOND_CONFIG, firstRunAt: at },
    ]);
  });
});
