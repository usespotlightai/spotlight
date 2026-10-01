import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import { spendingOf } from '@outcomes/domain/services/measures';
import {
  endedWithin,
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
}

export interface OutputCurrency {
  readonly currency: string | null;
  readonly mixedCurrencies: boolean;
}

export interface ConfigMarker {
  readonly lineId: string;
  readonly stationId: string;
  readonly fingerprint: string;
  readonly firstRunAt: Date;
  readonly runId: string;
}

export const dailyOutputOf = (
  history: TeamHistory,
  period: InsightsPeriod,
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

export const firstRanAt = (record: RunRecord): Date | null =>
  record.end ? (record.end.startedAt ?? record.end.endedAt) : null;

export const configMarkersAlong = (
  records: readonly RunRecord[],
): readonly ConfigMarker[] => {
  const seen = new Map<string, Set<string>>();
  const markers: ConfigMarker[] = [];
  const byStart = records
    .flatMap((record) => {
      const at = firstRanAt(record);
      return at ? [{ record, at }] : [];
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime());

  for (const { record, at } of byStart) {
    const end = record.end;
    const fingerprint = end?.fingerprint;

    if (!end || !fingerprint) {
      continue;
    }

    const before = seen.get(end.place.stationId) ?? new Set<string>();
    seen.set(end.place.stationId, new Set([...before, fingerprint]));

    if (before.size > 0 && !before.has(fingerprint)) {
      markers.push({
        lineId: end.place.lineId,
        stationId: end.place.stationId,
        fingerprint,
        firstRunAt: at,
        runId: record.runId.value,
      });
    }
  }

  return markers;
};

export const configMarkersOf = (
  history: TeamHistory,
  period: InsightsPeriod,
): readonly ConfigMarker[] =>
  configMarkersAlong(endedWithin(history.records, period.lookback)).filter(
    (each) => within(period.current, each.firstRunAt),
  );
