import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';

export const poolCouldTake = (
  placement: RunnerPlacement,
  labels: RunnerOffer,
): boolean => placement.matches(labels.runningIn(null));
