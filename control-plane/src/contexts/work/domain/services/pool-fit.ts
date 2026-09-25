import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';

export const poolCouldTake = (
  placement: RunnerPlacement,
  labels: RunnerTerms,
): boolean => placement.admits(labels.runningIn(null));
