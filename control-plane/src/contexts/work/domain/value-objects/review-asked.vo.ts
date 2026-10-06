import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { InvalidReviewRequestError } from '@work/domain/exceptions/invalid-review-request.error';
import { UnreviewablePullRequestError } from '@work/domain/exceptions/unreviewable-pull-request.error';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
import type { Said } from '@work/domain/value-objects/said.vo';

const REVIEW_ASKINGS = ['opened', 'mentioned'] as const;

export type ReviewAsking = (typeof REVIEW_ASKINGS)[number];

export const reviewAsking = (raw: string): ReviewAsking => {
  const asking = REVIEW_ASKINGS.find((each) => each === raw);

  if (!asking) {
    throw new InvalidReviewRequestError(
      'must come from an opened pull request or a mention',
    );
  }

  return asking;
};

export interface ReviewRequest {
  readonly asking: ReviewAsking;
  readonly pullRequest: PullRequestUrl;
  readonly author: string | null;
  readonly outside: boolean;
  readonly draft: boolean;
  readonly branch: Branch | null;
}

export const reviewRequested = (request: ReviewRequest): ReviewRequest => {
  if (
    !PullRequestLink.reviewing(request.pullRequest, {
      outside: request.outside,
    }).reviewedHead
  ) {
    throw new UnreviewablePullRequestError(request.pullRequest.value);
  }

  return request;
};

export interface ReviewAsked extends ReviewRequest {
  readonly said: Said | null;
  readonly ours: boolean;
}
