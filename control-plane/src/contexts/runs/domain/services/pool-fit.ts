import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';

export const poolCouldTake = (
  placement: RunnerPlacement,
  labels: RunnerOffer,
): boolean => placement.matches(labels.runningIn(null));

// A pool fits work when it could take the work at all. Its room does not count.
export const poolFits = (
  placement: RunnerPlacement,
  pool: { readonly labels: RunnerOffer; readonly egress: boolean },
  needsEgress: boolean,
): boolean =>
  (pool.egress || !needsEgress) && poolCouldTake(placement, pool.labels);
