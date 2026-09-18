import type { TeamTraceResponseDto } from '@/lib/api';
import type { Window } from '@/lib/range';

export type Traced = TeamTraceResponseDto;

export const spanned = (from: number, to: number): string => {
  const opened = new Date(from);
  const closed = new Date(to);
  const sameDay = opened.toDateString() === closed.toDateString();

  const clock = (at: Date) =>
    at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return sameDay
    ? `${startedOn(opened.toISOString())} – ${clock(closed)}`
    : `${startedOn(opened.toISOString())} – ${startedOn(closed.toISOString())}`;
};

export const startedOn = (at: string): string =>
  new Date(at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export interface Bucket {
  readonly from: number;
  readonly to: number;
  readonly faults: number;
  readonly count: number;
}

export const bucketed = (
  traces: readonly Traced[],
  window: Window,
  bucketMs: number,
): Bucket[] => {
  const { from, to } = window;
  const width = Math.max(bucketMs, 1);
  const count = Math.max(Math.ceil((to - from) / width), 1);

  const buckets: Bucket[] = Array.from({ length: count }, (_, at) => ({
    from: from + at * width,
    to: from + (at + 1) * width,
    faults: 0,
    count: 0,
  }));

  for (const trace of traces) {
    const at = new Date(trace.startedAt).getTime();
    const held = Math.min(
      Math.max(Math.floor((at - from) / width), 0),
      count - 1,
    );
    const bucket = buckets[held];

    buckets[held] = {
      ...bucket,
      faults: bucket.faults + trace.faults,
      count: bucket.count + 1,
    };
  }

  return buckets;
};
