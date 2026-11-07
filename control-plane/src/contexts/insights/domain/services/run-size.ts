import { InvalidAgentConfigFilterError } from '@insights/domain/exceptions/invalid-agent-config-filter.error';
import type { RunUsage } from '@insights/domain/value-objects/run-usage.vo';

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

export const requestedRunSizeOf = (raw: string | null): RunSize | null => {
  if (raw === null) {
    return null;
  }

  const size = runSizeOf(raw);

  if (!size) {
    throw new InvalidAgentConfigFilterError(
      `size must be one of ${RUN_SIZES.join(', ')}, not ${raw}`,
    );
  }

  return size;
};

export const sizeOf = (usage: RunUsage | null): RunSize | null => {
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
