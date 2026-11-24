import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';

// What a pool, or the hosts of a pull pool or a trust, can take.
export interface Offer {
  readonly labels: RunnerOffer;
  // It can send the traffic of a run through an egress, which injects the run's secrets.
  readonly egress: boolean;
  // The images it runs. Null: any image.
  readonly images: readonly RunnerImage[] | null;
  // The operator allows it runs that inject secrets. Only the platform pool can refuse them.
  readonly allowsSecrets: boolean;
  // The operator allows it checks and diffs. Only the platform pool can refuse them.
  readonly allowsReviewWork: boolean;
}

// What a piece of work needs from the runner that takes it, besides its placement.
export interface WorkNeeds {
  // It injects secrets or a Spotlight token.
  readonly secrets: boolean;
  // It is a check or a diff.
  readonly reviewWork: boolean;
}

export const poolCouldTake = (
  placement: RunnerPlacement,
  labels: RunnerOffer,
): boolean => placement.matches(labels.runningIn(null));

// An offer that names its images runs work that asks for one of them, or for no image.
const runsImageOf = (
  placement: RunnerPlacement,
  images: readonly RunnerImage[] | null,
): boolean => {
  const wanted = placement.image;

  return !wanted || !images || images.some((each) => each.equals(wanted));
};

// The offer could take the work if the operator allowed it all. Its room does not count.
export const offerCouldServe = (
  placement: RunnerPlacement,
  offer: Offer,
  needs: WorkNeeds,
): boolean =>
  (offer.egress || !needs.secrets) &&
  poolCouldTake(placement, offer.labels) &&
  runsImageOf(placement, offer.images);

// The offer can take the work: it could serve it, and the operator allows it this kind of work. Its room does not count.
export const poolFits = (
  placement: RunnerPlacement,
  offer: Offer,
  needs: WorkNeeds,
): boolean =>
  offerCouldServe(placement, offer, needs) &&
  (offer.allowsSecrets || !needs.secrets) &&
  (offer.allowsReviewWork || !needs.reviewWork);
