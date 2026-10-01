import {
  day,
  deliveredOf,
  historyOf,
} from '@outcomes/domain/insights.fake-spec';
import {
  costedRecord,
  FIRST_CONFIG,
  SECOND_CONFIG,
} from '@outcomes/domain/outcomes.fake-spec';
import {
  configMarkersOf,
  dailyOutputOf,
  outputCurrencyOf,
} from '@outcomes/domain/services/daily-output';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import { describe, expect, it } from 'vitest';

const PERIOD = InsightsPeriod.of('7d', new Date('2026-10-01T15:00:00.000Z'));

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

describe('configMarkersOf', () => {
  it('marks where a station first ran with a new config in the period', () => {
    const markers = configMarkersOf(
      historyOf({
        records: [
          costedRecord('run_1', {
            endedAt: day('2026-09-20'),
            fingerprint: FIRST_CONFIG,
          }),
          costedRecord('run_2', {
            endedAt: day('2026-09-26'),
            fingerprint: FIRST_CONFIG,
          }),
          costedRecord('run_3', {
            endedAt: day('2026-09-27'),
            fingerprint: SECOND_CONFIG,
          }),
          costedRecord('run_4', {
            endedAt: day('2026-09-28'),
            fingerprint: SECOND_CONFIG,
          }),
          costedRecord('run_5', {
            endedAt: day('2026-09-26'),
            stationId: 'station_2',
            fingerprint: SECOND_CONFIG,
          }),
        ],
      }),
      PERIOD,
    );

    expect(markers).toEqual([
      {
        lineId: 'line_1',
        stationId: 'station_1',
        fingerprint: SECOND_CONFIG,
        firstRunAt: day('2026-09-27'),
        runId: 'run_3',
      },
    ]);
  });

  it('marks a config only the first time the station ran it in the lookback, not when it returns to it', () => {
    const markers = configMarkersOf(
      historyOf({
        records: [
          costedRecord('run_1', {
            endedAt: day('2026-09-20'),
            fingerprint: FIRST_CONFIG,
          }),
          costedRecord('run_2', {
            endedAt: day('2026-09-26'),
            fingerprint: SECOND_CONFIG,
          }),
          costedRecord('run_3', {
            endedAt: day('2026-09-27'),
            fingerprint: FIRST_CONFIG,
          }),
        ],
      }),
      PERIOD,
    );

    expect(markers.map((each) => each.runId)).toEqual(['run_2']);
  });

  it('dates a marker from when the first run with the new config started, ordering runs by their start', () => {
    const markers = configMarkersOf(
      historyOf({
        records: [
          costedRecord('run_1', {
            endedAt: day('2026-09-20'),
            fingerprint: FIRST_CONFIG,
          }),
          costedRecord('run_2', {
            startedAt: day('2026-09-26', 8),
            endedAt: day('2026-09-27', 20),
            fingerprint: SECOND_CONFIG,
          }),
          costedRecord('run_3', {
            startedAt: day('2026-09-27', 9),
            endedAt: day('2026-09-27', 10),
            fingerprint: SECOND_CONFIG,
          }),
        ],
      }),
      PERIOD,
    );

    expect(markers).toMatchObject([
      { runId: 'run_2', firstRunAt: day('2026-09-26', 8) },
    ]);
  });
});
