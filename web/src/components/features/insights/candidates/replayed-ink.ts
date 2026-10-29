import type { ReplayedMark } from '@/lib/insights-candidates';

type Ink = {
  readonly fill: string;
  readonly swatch: string;
  readonly outline: string;
};

export const REPLAYED_INK: Record<ReplayedMark, Ink> = {
  baseline: {
    fill: 'var(--chart-5)',
    swatch: 'bg-foreground',
    outline: 'border-[1.5px] border-foreground',
  },
  searched: {
    fill: 'var(--chart-2)',
    swatch: 'bg-chart-2',
    outline: 'border-[1.5px] border-chart-2',
  },
};

export const FRONTIER_INK: Omit<Ink, 'outline'> = {
  fill: 'var(--chart-primary)',
  swatch: 'bg-chart-primary',
};
