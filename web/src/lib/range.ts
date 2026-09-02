/**
 * How far back a page is looking. Kept as a span rather than a pair of dates:
 * "the past hour" means something different an hour from now, and that is what
 * a reader watching a factory work actually wants.
 */
export interface Range {
  readonly id: string;
  readonly short: string;
  readonly label: string;
  readonly minutes: number;
  /**
   * How long one bar of the chart stands for. Set per range rather than held
   * constant: a month of half hours is a thousand bars too thin to read, and
   * an hour of them is six.
   */
  readonly bucketMinutes: number;
}

const HOUR = 60;
const DAY = 24 * HOUR;

export const RANGES: readonly Range[] = [
  {
    id: '30m',
    short: '30m',
    label: 'Past 30 min',
    minutes: 30,
    bucketMinutes: 2,
  },
  {
    id: '1h',
    short: '1h',
    label: 'Past 1 hour',
    minutes: HOUR,
    bucketMinutes: 2,
  },
  {
    id: '6h',
    short: '6h',
    label: 'Past 6 hours',
    minutes: 6 * HOUR,
    bucketMinutes: 10,
  },
  {
    id: '1d',
    short: '1d',
    label: 'Past 1 day',
    minutes: DAY,
    bucketMinutes: 10,
  },
  {
    id: '3d',
    short: '3d',
    label: 'Past 3 days',
    minutes: 3 * DAY,
    bucketMinutes: 30,
  },
  {
    id: '7d',
    short: '7d',
    label: 'Past 7 days',
    minutes: 7 * DAY,
    bucketMinutes: HOUR,
  },
  {
    id: '14d',
    short: '14d',
    label: 'Past 14 days',
    minutes: 14 * DAY,
    bucketMinutes: 2 * HOUR,
  },
  {
    id: '30d',
    short: '30d',
    label: 'Past 30 days',
    minutes: 30 * DAY,
    bucketMinutes: 8 * HOUR,
  },
  {
    id: '90d',
    short: '90d',
    label: 'Past 90 days',
    minutes: 90 * DAY,
    bucketMinutes: 2 * DAY,
  },
];

export const DEFAULT_RANGE = '30d';

export const rangeOf = (id: string): Range =>
  RANGES.find((each) => each.id === id) ??
  (RANGES.find((each) => each.id === DEFAULT_RANGE) as Range);

export interface Window {
  readonly from: number;
  readonly to: number;
}

/** The stretch being looked at, ending now. */
export const windowOf = (id: string, now = Date.now()): Window => ({
  from: now - rangeOf(id).minutes * 60_000,
  to: now,
});

/** How long one bar of this range stands for. */
export const bucketMsOf = (id: string): number =>
  rangeOf(id).bucketMinutes * 60_000;

/** When the stretch began, as the control plane wants it told. */
export const since = (id: string): string =>
  new Date(windowOf(id).from).toISOString();
