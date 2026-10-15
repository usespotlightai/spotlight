import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import {
  type CarriedConfigs,
  configChangesAlong,
} from '@outcomes/domain/services/config-stretches';
import type { ResolvedDelivery } from '@outcomes/domain/services/headline';
import { spendingOf } from '@outcomes/domain/services/measures';
import {
  endedWithin,
  startedWithin,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
import {
  dayOf,
  type InsightsPeriod,
  within,
} from '@outcomes/domain/value-objects/insights-period.vo';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';

export interface DayOutput {
  readonly day: string;
  readonly runs: number;
  readonly spend: Spend | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
  readonly merged: number;
  readonly mergedTaskIds: readonly string[];
  readonly changes: readonly ConfigMarker[];
}

export interface OutputCurrency {
  readonly currency: string | null;
  readonly mixedCurrencies: boolean;
}

export interface ConfigMarker {
  readonly lineId: string;
  readonly stationId: string;
  readonly fingerprint: string;
  readonly previousFingerprint: string;
  readonly firstRunAt: Date;
  readonly runId: string;
}

export interface DaySpending {
  readonly runs: number;
  readonly spend: Spend | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
}

const NO_SPENDING: DaySpending = {
  runs: 0,
  spend: null,
  unpriced: 0,
  mixedCurrencies: false,
};

export const daySpendingOf = (
  history: TeamHistory,
  period: InsightsPeriod,
): ReadonlyMap<string, DaySpending> => {
  const byDay = new Map<string, RunRecord[]>();

  for (const record of endedWithin(history.records, period.current)) {
    if (record.ran && record.end) {
      const day = dayOf(record.end.endedAt);
      byDay.set(day, [...(byDay.get(day) ?? []), record]);
    }
  }

  return new Map(
    [...byDay].map(([day, runs]) => {
      const { spend, unpriced, mixedCurrencies } = spendingOf(
        runs.map((each) => each.cost?.spend ?? null),
      );

      return [day, { runs: runs.length, spend, unpriced, mixedCurrencies }];
    }),
  );
};

export const dailyOutputFrom = (
  spending: ReadonlyMap<string, DaySpending>,
  resolved: readonly ResolvedDelivery[],
  period: InsightsPeriod,
  markers: readonly ConfigMarker[],
): readonly DayOutput[] => {
  const merged = resolved.filter(
    (each) => each.merged && within(period.current, each.closedAt),
  );

  return period.days.map((day) => {
    const mergedThatDay = merged.filter((each) => dayOf(each.closedAt) === day);

    return {
      day,
      ...(spending.get(day) ?? NO_SPENDING),
      merged: mergedThatDay.length,
      mergedTaskIds: mergedThatDay.map((each) => each.taskId),
      changes: markers.filter((each) => dayOf(each.firstRunAt) === day),
    };
  });
};

export const outputCurrencyOf = (
  output: readonly DayOutput[],
): OutputCurrency => {
  const currencies = new Set(
    output.flatMap((each) => (each.spend ? [each.spend.currency] : [])),
  );
  const mixedCurrencies =
    currencies.size > 1 || output.some((each) => each.mixedCurrencies);

  return {
    currency: mixedCurrencies ? null : ([...currencies][0] ?? null),
    mixedCurrencies,
  };
};

export const beganAt = (record: RunRecord): Date | null =>
  record.end?.beganAt ?? null;

export const configMarkersAlong = (
  records: readonly RunRecord[],
  before: readonly RunRecord[] = [],
): readonly ConfigMarker[] =>
  configChangesAlong(records, before).flatMap(({ run, previous }) =>
    previous === null
      ? []
      : [
          {
            lineId: run.lineId,
            stationId: run.stationId,
            fingerprint: run.fingerprint,
            previousFingerprint: previous,
            firstRunAt: run.beganAt,
            runId: run.runId.value,
          },
        ],
  );

export const configMarkersOf = (
  history: TeamHistory,
  period: InsightsPeriod,
  carried: CarriedConfigs,
): readonly ConfigMarker[] =>
  configMarkersAlong(
    startedWithin(history.records, {
      from: carried.from,
      to: period.lookback.to,
    }),
    carried.lastRuns,
  ).filter((each) => within(period.current, each.firstRunAt));
