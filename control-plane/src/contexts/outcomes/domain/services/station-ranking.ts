import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { failuresWithin } from '@outcomes/domain/services/failure-summaries';
import { rateOf } from '@outcomes/domain/services/measures';
import { type RunTally, runTally } from '@outcomes/domain/services/run-tally';
import {
  atStation,
  endedWithin,
  type StationPlace,
  stationsOf,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
import type {
  InsightsPeriod,
  Window,
} from '@outcomes/domain/value-objects/insights-period.vo';

export const STATION_SIGNALS = [
  'sent-back',
  'checks-failed',
  'run-failures',
  'task-failures',
  'cost',
] as const;

type StationSignal = (typeof STATION_SIGNALS)[number];

export interface SignalReading {
  readonly signal: StationSignal;
  readonly now: number;
  readonly before: number | null;
  readonly team: number | null;
  readonly rose: boolean;
  readonly trails: boolean;
  readonly currency: string | null;
}

export interface StationWorthImproving extends StationPlace {
  readonly runs: number;
  readonly signals: readonly SignalReading[];
  readonly worstBy: number;
  readonly mixedCurrencies: boolean;
}

const FEWEST_RUNS = 3;
const WORSE_BY = 1.25;
const RATE_MARGIN = 0.05;

interface Rates {
  readonly 'sent-back': number | null;
  readonly 'checks-failed': number | null;
  readonly 'run-failures': number | null;
  readonly 'task-failures': number | null;
  readonly cost: number | null;
}

const ratesOf = (tally: RunTally, taskFailures: number): Rates => ({
  'sent-back': rateOf(tally.sentBack, tally.runs),
  'checks-failed': rateOf(
    tally.checksFailed,
    tally.checksPassed + tally.checksFailed,
  ),
  'run-failures': rateOf(tally.failed, tally.runs),
  'task-failures': rateOf(taskFailures, tally.runs),
  cost: tally.cost ? rateOf(tally.cost.amount, tally.runs) : null,
});

const worse = (
  signal: StationSignal,
  now: number,
  than: number | null,
): boolean =>
  than !== null &&
  now > than * WORSE_BY &&
  (signal === 'cost' || now - than >= RATE_MARGIN);

const MOST_WORSE = 10;

const worseByOf = (reading: SignalReading): number => {
  const than = Math.max(
    reading.rose ? (reading.before ?? 0) : 0,
    reading.trails ? (reading.team ?? 0) : 0,
  );

  return than > 0 ? Math.min(reading.now / than, MOST_WORSE) : MOST_WORSE;
};

const comparable = (
  tallied: { readonly rates: Rates; readonly currency: string | null },
  currency: string | null,
): Rates =>
  tallied.currency === currency
    ? tallied.rates
    : { ...tallied.rates, cost: null };

export const stationsWorthImproving = (
  history: TeamHistory,
  period: InsightsPeriod,
): readonly StationWorthImproving[] => {
  const current = endedWithin(history.records, period.current);
  const previous = endedWithin(history.records, period.previous);
  const tallied = (
    records: readonly RunRecord[],
    window: Window,
    stationId: string | null,
  ) => {
    const tally = runTally(records, history.deliveries);

    return {
      rates: ratesOf(
        tally,
        failuresWithin(history.failures, window, stationId).length,
      ),
      currency: tally.cost?.currency ?? null,
      mixedCurrencies: tally.mixedCurrencies,
    };
  };
  const teamTally = tallied(current, period.current, null);

  return stationsOf(current)
    .flatMap((place) => {
      const here = atStation(current, place.stationId);
      const runs = here.filter((each) => each.ran).length;

      if (runs < FEWEST_RUNS) {
        return [];
      }

      const tallyNow = tallied(here, period.current, place.stationId);
      const tallyBefore = tallied(
        atStation(previous, place.stationId),
        period.previous,
        place.stationId,
      );
      const now = tallyNow.rates;
      const before = comparable(tallyBefore, tallyNow.currency);
      const team = comparable(teamTally, tallyNow.currency);
      const signals = STATION_SIGNALS.flatMap((signal): SignalReading[] => {
        const reading = now[signal];

        if (reading === null) {
          return [];
        }

        const rose = worse(signal, reading, before[signal]);
        const trails = worse(signal, reading, team[signal]);

        return rose || trails
          ? [
              {
                signal,
                now: reading,
                before: before[signal],
                team: team[signal],
                rose,
                trails,
                currency: signal === 'cost' ? tallyNow.currency : null,
              },
            ]
          : [];
      });

      return signals.length > 0
        ? [
            {
              ...place,
              runs,
              signals,
              worstBy: Math.max(...signals.map(worseByOf)),
              mixedCurrencies:
                tallyNow.mixedCurrencies || tallyBefore.mixedCurrencies,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        b.signals.length - a.signals.length ||
        b.worstBy - a.worstBy ||
        b.runs - a.runs,
    );
};
