export interface RateInterval {
  readonly rate: number;
  readonly low: number;
  readonly high: number;
}

export interface Bootstrapped {
  readonly mean: number;
  readonly low: number;
  readonly high: number;
}

const RESAMPLES = 2000;

const LOW_TAIL = 0.025;

const HIGH_TAIL = 0.975;

const hashOf = (seed: string): number => {
  let hash = 2166136261;

  for (let at = 0; at < seed.length; at += 1) {
    hash ^= seed.charCodeAt(at);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

export const seededRandom = (seed: string): (() => number) => {
  let state = hashOf(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

const meanOf = (values: readonly number[]): number =>
  values.reduce((sum, each) => sum + each, 0) / values.length;

export const bootstrapped = (
  values: readonly number[],
  seed: string,
): Bootstrapped | null => {
  if (values.length === 0) {
    return null;
  }

  const random = seededRandom(seed);
  const means = Array.from({ length: RESAMPLES }, () => {
    let sum = 0;

    for (let drawn = 0; drawn < values.length; drawn += 1) {
      sum += values[Math.floor(random() * values.length)] as number;
    }

    return sum / values.length;
  }).sort((one, other) => one - other);

  return {
    mean: meanOf(values),
    low: means[Math.floor(RESAMPLES * LOW_TAIL)] as number,
    high: means[Math.ceil(RESAMPLES * HIGH_TAIL) - 1] as number,
  };
};

export const rateIntervalOf = (
  perTask: readonly number[],
  seed: string,
): RateInterval | null => {
  const read = bootstrapped(perTask, seed);

  return read && { rate: read.mean, low: read.low, high: read.high };
};
