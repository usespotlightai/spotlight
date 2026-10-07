import { InvalidTraceRangeError } from '@work/domain/exceptions/invalid-trace-range.error';

const MINUTE_MS = 60_000;
const HOUR = 60;
const DAY = 24 * HOUR;

interface Stretch {
  readonly minutes: number;
  readonly bucketMinutes: number;
}

const STRETCHES = {
  '30m': { minutes: 30, bucketMinutes: 2 },
  '1h': { minutes: HOUR, bucketMinutes: 2 },
  '6h': { minutes: 6 * HOUR, bucketMinutes: 10 },
  '1d': { minutes: DAY, bucketMinutes: 10 },
  '3d': { minutes: 3 * DAY, bucketMinutes: 30 },
  '7d': { minutes: 7 * DAY, bucketMinutes: HOUR },
  '14d': { minutes: 14 * DAY, bucketMinutes: 2 * HOUR },
  '30d': { minutes: 30 * DAY, bucketMinutes: 8 * HOUR },
  '90d': { minutes: 90 * DAY, bucketMinutes: 2 * DAY },
} as const satisfies Record<string, Stretch>;

export type TraceRangeName = keyof typeof STRETCHES;

export const TRACE_RANGES = Object.keys(STRETCHES) as TraceRangeName[];

export const DEFAULT_TRACE_RANGE: TraceRangeName = '30d';

export class TraceRange {
  private constructor(
    readonly name: TraceRangeName,
    readonly from: Date,
    readonly to: Date,
    readonly bucketMs: number,
  ) {}

  static of(raw: string, now: Date): TraceRange {
    const name = TRACE_RANGES.find((each) => each === raw.trim());

    if (!name) {
      throw new InvalidTraceRangeError(TRACE_RANGES);
    }

    const { minutes, bucketMinutes } = STRETCHES[name];

    return new TraceRange(
      name,
      new Date(now.getTime() - minutes * MINUTE_MS),
      now,
      bucketMinutes * MINUTE_MS,
    );
  }
}
