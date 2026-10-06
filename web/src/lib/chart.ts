export const AXIS_TITLE = { fill: 'var(--chart-axis)', fontSize: 10 } as const;

export const costTick = (cost: number, currency: string): string =>
  cost.toLocaleString('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(cost) ? 0 : 2,
    maximumFractionDigits: 2,
  });
