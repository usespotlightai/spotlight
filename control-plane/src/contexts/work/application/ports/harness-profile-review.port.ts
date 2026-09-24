import type {
  HarnessProfileShape,
  ProfileReview,
} from '@work/application/contracts/harness-profile.contract';

export const HARNESS_PROFILE_REVIEW = Symbol('HARNESS_PROFILE_REVIEW');

export interface HarnessProfileReviewPort {
  review(profile: HarnessProfileShape): ProfileReview;
}
