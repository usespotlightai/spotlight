export const CHARTED_AS = [
  'priced',
  'unpriced',
  'other-currency',
  'unscored',
  'unfinished',
] as const;

export type ChartedAs = (typeof CHARTED_AS)[number];

export interface ChartedReading {
  readonly finished: boolean;
  readonly success: number | null;
  readonly cost: number | null;
  readonly currency: string;
}

export const chartCurrencyOf = (
  baseline: string | null,
  newestCandidate: string | null,
): string | null => baseline ?? newestCandidate;

export const chartedAs = (
  reading: ChartedReading,
  chartCurrency: string | null,
): ChartedAs => {
  if (!reading.finished) {
    return 'unfinished';
  }
  if (reading.success === null) {
    return 'unscored';
  }
  if (reading.cost === null) {
    return 'unpriced';
  }

  return reading.currency === chartCurrency ? 'priced' : 'other-currency';
};
