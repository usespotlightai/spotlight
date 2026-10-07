import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import {
  type CarriedConfigs,
  configChangesAlong,
} from '@outcomes/domain/services/config-stretches';
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

export const dailyOutputOf = (
  history: TeamHistory,
  period: InsightsPeriod,
  markers: readonly ConfigMarker[],
): readonly DayOutput[] => {
  const ran = endedWithin(history.records, period.current).filter(
    (each) => each.ran,
  );
  const merged = history.deliveries.filter(
    (each) => each.merged && within(period.current, each.closedAt),
  );

  return period.days.map((day) => {
    const runs = ran.filter(
      (each) => each.end && dayOf(each.end.endedAt) === day,
    );
    const mergedThatDay = merged.filter(
      (each) => each.closedAt && dayOf(each.closedAt) === day,
    );

    const { spend, unpriced, mixedCurrencies } = spendingOf(
      runs.map((each) => each.cost?.spend ?? null),
    );

    return {
      day,
      runs: runs.length,
      spend,
      unpriced,
      mixedCurrencies,
      merged: mergedThatDay.length,
      mergedTaskIds: mergedThatDay.map((each) => each.taskId.value),
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
