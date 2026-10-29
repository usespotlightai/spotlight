import type { Rounds } from '@/lib/insights-shipping';

export const WAIT_SERIES = [
  { key: 'queued', label: 'Queued', fill: 'var(--chart-3)' },
  { key: 'running', label: 'Running', fill: 'var(--chart-primary)' },
  { key: 'inbox', label: 'In the inbox', fill: 'var(--chart-5)' },
] as const;

export const AUTHOR_SERIES = [
  { key: 'spotlight', label: 'Spotlight’s', color: 'var(--chart-primary)' },
  { key: 'people', label: 'People’s alone', color: 'var(--chart-2)' },
] as const;

export const SPOTLIGHT_SHARE_SERIES = [
  { key: 'authored', label: 'Made by Spotlight', fill: 'var(--chart-primary)' },
  { key: 'reviewed', label: 'Reviewed by Spotlight', fill: 'var(--chart-4)' },
  { key: 'people', label: 'People alone', fill: 'var(--chart-1)' },
  { key: 'bots', label: 'Bots alone', fill: 'var(--chart-2)' },
] as const;

const shade = (share: number): string =>
  `color-mix(in oklab, var(--chart-primary) ${share}%, var(--card))`;

export const ROUND_FILLS: Record<Rounds, string> = {
  '0': shade(28),
  '1': shade(52),
  '2': shade(76),
  '3+': shade(100),
};

export const THROUGHPUT = 'var(--chart-5)';

export const TYPE_SERIES = [
  { label: 'Spotlight', color: 'var(--chart-primary)' },
  { label: 'People alone', color: 'var(--chart-1)' },
] as const;

const SLICE_FILLS = [
  'var(--chart-primary)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-3)',
] as const;

export const sliceFill = (at: number): string =>
  SLICE_FILLS[at] ?? 'var(--chart-1)';
