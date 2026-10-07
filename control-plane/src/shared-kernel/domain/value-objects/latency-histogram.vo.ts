import { InvalidLatencyHistogramError } from '@shared-kernel/domain/exceptions/invalid-latency-histogram.error';

const LATENCY_BOUNDS_MS: readonly number[] = [
  10, 20, 50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000,
  100_000, 200_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000,
];

export const LATENCY_BUCKETS = LATENCY_BOUNDS_MS.length + 1;

const whole = (count: number): boolean =>
  Number.isSafeInteger(count) && count >= 0;

const bucketOf = (ms: number): number => {
  const at = LATENCY_BOUNDS_MS.findIndex((bound) => ms < bound);

  return at === -1 ? LATENCY_BOUNDS_MS.length : at;
};

const typicalOf = (bucket: number): number => {
  const below = LATENCY_BOUNDS_MS[bucket - 1];
  const above = LATENCY_BOUNDS_MS[bucket];

  if (below === undefined) {
    return Math.round((above ?? 0) / 2);
  }

  return above === undefined ? below : Math.round(Math.sqrt(below * above));
};

export class LatencyHistogram {
  private constructor(readonly counts: readonly number[]) {}

  static readonly EMPTY = new LatencyHistogram(
    Array.from({ length: LATENCY_BUCKETS }, () => 0),
  );

  static of(counts: readonly number[]): LatencyHistogram {
    if (counts.length !== LATENCY_BUCKETS) {
      throw new InvalidLatencyHistogramError(
        `must have exactly ${LATENCY_BUCKETS} buckets`,
      );
    }
    if (!counts.every(whole)) {
      throw new InvalidLatencyHistogramError(
        'must count whole calls in each bucket',
      );
    }

    return new LatencyHistogram([...counts]);
  }

  static timing(ms: readonly number[]): LatencyHistogram {
    return ms.reduce<LatencyHistogram>(
      (histogram, each) => histogram.with(each),
      LatencyHistogram.EMPTY,
    );
  }

  get timed(): number {
    return this.counts.reduce((sum, each) => sum + each, 0);
  }

  with(ms: number): LatencyHistogram {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new InvalidLatencyHistogramError(
        'must time calls in milliseconds from zero',
      );
    }

    const bucket = bucketOf(ms);

    return new LatencyHistogram(
      this.counts.map((each, at) => (at === bucket ? each + 1 : each)),
    );
  }

  plus(other: LatencyHistogram): LatencyHistogram {
    return new LatencyHistogram(
      this.counts.map((each, at) => each + (other.counts[at] ?? 0)),
    );
  }

  percentile(percent: number): number | null {
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      throw new InvalidLatencyHistogramError(
        'percentile must be above 0 and at most 100',
      );
    }

    const timed = this.timed;

    if (timed === 0) {
      return null;
    }

    const rank = Math.min(
      Math.max(Math.ceil((percent / 100) * timed), 1),
      timed,
    );
    let seen = 0;

    for (const [bucket, count] of this.counts.entries()) {
      seen += count;

      if (seen >= rank) {
        return typicalOf(bucket);
      }
    }

    return null;
  }
}
