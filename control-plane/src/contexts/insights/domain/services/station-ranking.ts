import type { LocatedFailure } from '@insights/domain/services/failure-summaries';
import { rateOf } from '@insights/domain/services/measures';
import type { TallyCounts } from '@insights/domain/services/run-tally';
import type { TeamCounts } from '@insights/domain/services/station-reports';
import type { StationLocation } from '@insights/domain/services/team-history';

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
  readonly flaggedAbove: number;
  readonly currency: string | null;
}

export interface StationWorthImproving extends StationLocation {
  readonly runs: number;
  readonly signals: readonly SignalReading[];
  readonly worstBy: number;
  readonly mixedCurrencies: boolean;
}

const MIN_RUNS = 3;
const WORSE_BY = 1.25;
const RATE_MARGIN = 0.05;

interface Rates {
  readonly 'sent-back': number | null;
  readonly 'checks-failed': number | null;
  readonly 'run-failures': number | null;
  readonly 'task-failures': number | null;
  readonly cost: number | null;
}

const ratesOf = (tally: TallyCounts, taskFailures: number): Rates => ({
  'sent-back': rateOf(tally.sentBack, tally.runs),
  'checks-failed': rateOf(
    tally.checksFailed,
    tally.checksPassed + tally.checksFailed,
  ),
  'run-failures': rateOf(tally.failed, tally.runs),
  'task-failures': rateOf(taskFailures, tally.runs),
  cost: tally.cost ? rateOf(tally.cost.amount, tally.runs) : null,
});

const worseLineOf = (signal: StationSignal, than: number): number =>
  signal === 'cost'
    ? than * WORSE_BY
    : Math.max(than * WORSE_BY, than + RATE_MARGIN);

const worse = (
  signal: StationSignal,
  now: number,
  than: number | null,
): boolean =>
  than !== null && now > than * WORSE_BY && now >= worseLineOf(signal, than);

const MAX_WORSE = 10;

const worseByOf = (reading: SignalReading): number => {
  const than = Math.max(
    reading.rose ? (reading.before ?? 0) : 0,
    reading.trails ? (reading.team ?? 0) : 0,
  );

  return than > 0 ? Math.min(reading.now / than, MAX_WORSE) : MAX_WORSE;
};

const comparable = (
  tallied: { readonly rates: Rates; readonly currency: string | null },
  currency: string | null,
): Rates =>
  tallied.currency === currency
    ? tallied.rates
    : { ...tallied.rates, cost: null };

export const stationsWorthImprovingFrom = (
  counts: TeamCounts,
  failingBefore: readonly LocatedFailure[],
): readonly StationWorthImproving[] => {
  const tallied = (
    tally: TallyCounts,
    failing: readonly LocatedFailure[],
    stationId: string | null,
  ) => ({
    rates: ratesOf(
      tally,
      failing.filter(
        (each) => stationId === null || each.occurrence.stationId === stationId,
      ).length,
    ),
    currency: tally.cost?.currency ?? null,
    mixedCurrencies: tally.mixedCurrencies,
  });
  const teamTally = tallied(counts.team.current, counts.failing, null);

  return counts.stations
    .flatMap((station) => {
      const location = { lineId: station.lineId, stationId: station.stationId };
      const runs = station.current.runs;

      if (runs < MIN_RUNS) {
        return [];
      }

      const tallyNow = tallied(
        station.current,
        counts.failing,
        station.stationId,
      );
      const tallyBefore = tallied(
        station.previous,
        failingBefore,
        station.stationId,
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

        const crossed = [
          rose ? before[signal] : null,
          trails ? team[signal] : null,
        ].flatMap((than) => (than === null ? [] : [worseLineOf(signal, than)]));

        return rose || trails
          ? [
              {
                signal,
                now: reading,
                before: before[signal],
                team: team[signal],
                rose,
                trails,
                flaggedAbove: Math.min(...crossed),
                currency: signal === 'cost' ? tallyNow.currency : null,
              },
            ]
          : [];
      });

      return signals.length > 0
        ? [
            {
              ...location,
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
