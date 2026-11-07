export const CHART_STATUSES = [
  'priced',
  'unpriced',
  'other-currency',
  'unscored',
  'unfinished',
] as const;

export type ChartStatus = (typeof CHART_STATUSES)[number];

export interface ChartPoint {
  readonly finished: boolean;
  readonly success: number | null;
  readonly cost: number | null;
  readonly currency: string;
}

export const chartCurrencyOf = (
  baseline: string | null,
  newestCandidate: string | null,
): string | null => baseline ?? newestCandidate;

export const chartStatusOf = (
  point: ChartPoint,
  chartCurrency: string | null,
): ChartStatus => {
  if (!point.finished) {
    return 'unfinished';
  }
  if (point.success === null) {
    return 'unscored';
  }
  if (point.cost === null) {
    return 'unpriced';
  }

  return point.currency === chartCurrency ? 'priced' : 'other-currency';
};
