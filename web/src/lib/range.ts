import type { TeamTracesResponseDto } from '@/lib/api';

type RangeId = TeamTracesResponseDto['range'];

export interface Range {
  readonly id: RangeId;
  readonly short: string;
  readonly label: string;
}

export const RANGES: readonly Range[] = [
  { id: '30m', short: '30m', label: 'Past 30 min' },
  { id: '1h', short: '1h', label: 'Past 1 hour' },
  { id: '6h', short: '6h', label: 'Past 6 hours' },
  { id: '1d', short: '1d', label: 'Past 1 day' },
  { id: '3d', short: '3d', label: 'Past 3 days' },
  { id: '7d', short: '7d', label: 'Past 7 days' },
  { id: '14d', short: '14d', label: 'Past 14 days' },
  { id: '30d', short: '30d', label: 'Past 30 days' },
  { id: '90d', short: '90d', label: 'Past 90 days' },
];

export const DEFAULT_RANGE: RangeId = '30d';

export const rangeOf = (id: string): Range =>
  RANGES.find((each) => each.id === id) ??
  (RANGES.find((each) => each.id === DEFAULT_RANGE) as Range);
