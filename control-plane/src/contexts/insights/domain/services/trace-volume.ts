import type { TraceRange } from '@insights/domain/value-objects/trace-range.vo';

export interface Traced {
  readonly at: Date;
  readonly errors: number;
}

export interface VolumeBucket {
  readonly from: Date;
  readonly to: Date;
  readonly count: number;
  readonly errors: number;
}

export const traceVolumeOf = (
  traces: readonly Traced[],
  range: TraceRange,
): VolumeBucket[] => {
  const from = range.from.getTime();
  const width = Math.max(range.bucketMs, 1);
  const length = Math.max(Math.ceil((range.to.getTime() - from) / width), 1);

  const counts = new Array<number>(length).fill(0);
  const errors = new Array<number>(length).fill(0);

  for (const trace of traces) {
    const at = Math.min(
      Math.max(Math.floor((trace.at.getTime() - from) / width), 0),
      length - 1,
    );
    counts[at] = (counts[at] ?? 0) + 1;
    errors[at] = (errors[at] ?? 0) + trace.errors;
  }

  return counts.map((count, at) => ({
    from: new Date(from + at * width),
    to: new Date(from + (at + 1) * width),
    count,
    errors: errors[at] ?? 0,
  }));
};
