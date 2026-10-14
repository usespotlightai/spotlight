import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';

export interface Spread {
  readonly p50: number | null;
  readonly p90: number | null;
  readonly count: number;
}

const sorted = (values: readonly number[]): number[] =>
  [...values].sort((a, b) => a - b);

export const medianOf = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const ordered = sorted(values);
  const middle = Math.floor(ordered.length / 2);

  return ordered.length % 2 === 1
    ? (ordered[middle] ?? null)
    : Math.round(((ordered[middle - 1] ?? 0) + (ordered[middle] ?? 0)) / 2);
};

export const percentileOf = (
  values: readonly number[],
  percent: number,
): number | null => {
  if (values.length === 0) {
    return null;
  }

  const ordered = sorted(values);
  const rank = Math.ceil((percent / 100) * ordered.length);

  return ordered[Math.min(Math.max(rank, 1), ordered.length) - 1] ?? null;
};

export const NO_SPREAD: Spread = { p50: null, p90: null, count: 0 };

export const spreadOf = (values: readonly number[]): Spread => ({
  p50: medianOf(values),
  p90: percentileOf(values, 90),
  count: values.length,
});

export interface Percentiles {
  readonly p50: number | null;
  readonly p75: number | null;
  readonly p90: number | null;
  readonly p95: number | null;
  readonly count: number;
}

const PERCENTILES = ['p50', 'p75', 'p90', 'p95'] as const;

export type Percentile = (typeof PERCENTILES)[number];

export type ByPercentile<T> = Readonly<Record<Percentile, T>>;

export const byPercentile = <T>(
  of: (percentile: Percentile) => T,
): ByPercentile<T> => ({
  p50: of('p50'),
  p75: of('p75'),
  p90: of('p90'),
  p95: of('p95'),
});

export const known = (values: readonly (number | null)[]): number[] =>
  values.flatMap((each) => (each === null ? [] : [each]));

export const percentilesOf = (values: readonly number[]): Percentiles => ({
  p50: medianOf(values),
  p75: percentileOf(values, 75),
  p90: percentileOf(values, 90),
  p95: percentileOf(values, 95),
  count: values.length,
});

export const rateOf = (part: number, whole: number): number | null =>
  whole > 0 ? part / whole : null;

export interface Spending {
  readonly spend: Spend | null;
  readonly priced: number;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
}

export const spendingOf = (spends: readonly (Spend | null)[]): Spending => {
  const priced = spends.flatMap((each) => (each ? [each] : []));
  const [first] = priced;
  const mixedCurrencies = priced.some(
    (each) => each.currency !== first?.currency,
  );

  return {
    spend:
      first && !mixedCurrencies
        ? {
            amount: priced.reduce((sum, each) => sum + each.amount, 0),
            currency: first.currency,
          }
        : null,
    priced: priced.length,
    unpriced: spends.length - priced.length,
    mixedCurrencies,
  };
};

export const between = (from: Date, to: Date): number =>
  to.getTime() - from.getTime();
