import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';

export const RUN_SIZES = ['small', 'medium', 'large'] as const;

export type RunSize = (typeof RUN_SIZES)[number];

export interface SizeBound {
  readonly size: RunSize;
  readonly mostLines: number | null;
  readonly mostSteps: number | null;
}

export const SIZE_BOUNDS: readonly SizeBound[] = [
  { size: 'small', mostLines: 50, mostSteps: 20 },
  { size: 'medium', mostLines: 400, mostSteps: 80 },
  { size: 'large', mostLines: null, mostSteps: null },
];

const within = (count: number, most: number | null): boolean =>
  most === null || count <= most;

export const runSizeOf = (raw: string): RunSize | null =>
  RUN_SIZES.find((each) => each === raw.trim()) ?? null;

export const sizeOf = (record: RunRecord): RunSize | null => {
  const cost = record.cost;

  if (!cost) {
    return null;
  }

  const bound = SIZE_BOUNDS.find((each) =>
    cost.changedLines > 0
      ? within(cost.changedLines, each.mostLines)
      : within(cost.steps, each.mostSteps),
  );

  return bound?.size ?? 'large';
};
