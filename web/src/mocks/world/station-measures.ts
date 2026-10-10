import type {
  GainReadingResponseDto,
  RateIntervalResponseDto,
} from '@/lib/api';

export const MIN_GAIN = 0.05;

export const rounded = (value: number, places = 2): number =>
  Math.round(value * 10 ** places) / 10 ** places;

export const spread = (seed: string, low: number, high: number): number => {
  const sum = [...seed].reduce(
    (total, letter, place) => total + letter.charCodeAt(0) * (place + 7),
    0,
  );

  return low + ((sum % 97) / 96) * (high - low);
};

export const rateOf = (count: number, of: number): number | null =>
  of === 0 ? null : count / of;

export const intervalOf = (
  succeeded: number,
  scored: number,
): RateIntervalResponseDto | null => {
  if (scored === 0) {
    return null;
  }

  const z = 1.96;
  const rate = succeeded / scored;
  const centre = (rate + (z * z) / (2 * scored)) / (1 + (z * z) / scored);
  const half =
    (z / (1 + (z * z) / scored)) *
    Math.sqrt((rate * (1 - rate)) / scored + (z * z) / (4 * scored * scored));

  return {
    rate: rounded(rate),
    low: rounded(Math.max(0, centre - half)),
    high: rounded(Math.min(1, centre + half)),
  };
};

export const gainOf = (
  candidate: readonly boolean[],
  baseline: readonly boolean[],
): GainReadingResponseDto | null => {
  const tasks = Math.min(candidate.length, baseline.length);

  if (tasks === 0) {
    return null;
  }

  const share = (each: readonly boolean[]) =>
    each.filter(Boolean).length / each.length;
  const gain = share(candidate) - share(baseline);
  const differences = candidate.map(
    (each, place) => Number(each) - Number(baseline[place]),
  );
  const mean = differences.reduce((total, each) => total + each, 0) / tasks;
  const variance =
    differences.reduce((total, each) => total + (each - mean) ** 2, 0) /
    Math.max(1, tasks - 1);
  const half = Math.max(0.1, 1.28 * Math.sqrt(variance / tasks));
  const low = Math.max(-1, gain - half);
  const high = Math.min(1, gain + half);

  return {
    gain: rounded(gain),
    low: rounded(low),
    high: rounded(high),
    verdict:
      low > MIN_GAIN ? 'better' : high < -MIN_GAIN ? 'worse' : 'within-noise',
    minGain: MIN_GAIN,
    tasks,
  };
};

export const medianOf = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((one, other) => one - other);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

export const percentileOf = (
  values: readonly number[],
  percentile: number,
): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((one, other) => one - other);
  const place = Math.ceil((percentile / 100) * sorted.length) - 1;

  return sorted[Math.max(0, place)] ?? null;
};

export const dayOf = (iso: string): string => iso.slice(0, 10);

export const hoursSince = (iso: string): number =>
  (Date.now() - Date.parse(iso)) / 3_600_000;
