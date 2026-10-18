import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';

export const RUN_SIZES = ['small', 'medium', 'large'] as const;

export type RunSize = (typeof RUN_SIZES)[number];

export interface SizeBound {
  readonly size: RunSize;
  readonly maxLines: number | null;
  readonly maxSteps: number | null;
}

export const SIZE_BOUNDS: readonly SizeBound[] = [
  { size: 'small', maxLines: 50, maxSteps: 20 },
  { size: 'medium', maxLines: 400, maxSteps: 80 },
  { size: 'large', maxLines: null, maxSteps: null },
];

const within = (count: number, max: number | null): boolean =>
  max === null || count <= max;

export const runSizeOf = (raw: string): RunSize | null =>
  RUN_SIZES.find((each) => each === raw.trim()) ?? null;

export const sizeOf = (record: RunRecord): RunSize | null => {
  const usage = record.usage;

  if (!usage) {
    return null;
  }

  const bound = SIZE_BOUNDS.find((each) =>
    usage.changedLines > 0
      ? within(usage.changedLines, each.maxLines)
      : within(usage.steps, each.maxSteps),
  );

  return bound?.size ?? 'large';
};
