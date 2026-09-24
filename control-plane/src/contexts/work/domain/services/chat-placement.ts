import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';

export const chatPlacement = (
  repositories: readonly Repository[],
  lines: readonly Line[],
): RunnerPlacement =>
  RunnerPlacement.every(
    lines
      .filter((line) => repositories.some((each) => line.names(each)))
      .map((line) => line.placement),
  );
