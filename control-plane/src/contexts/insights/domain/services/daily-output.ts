import type { ResolvedDelivery } from '@insights/domain/services/headline';
import {
  dayOf,
  type InsightsPeriod,
  within,
} from '@insights/domain/value-objects/insights-period.vo';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';

export interface DayOutput {
  readonly day: string;
  readonly runs: number;
  readonly spend: Money | null;
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
  readonly spend: Money | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
}

const NO_SPENDING: DaySpending = {
  runs: 0,
  spend: null,
  unpriced: 0,
  mixedCurrencies: false,
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
