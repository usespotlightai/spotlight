import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { InvalidReviewRequestError } from '@work/domain/exceptions/invalid-review-request.error';
import { UnreviewablePullRequestError } from '@work/domain/exceptions/unreviewable-pull-request.error';
import type { Anchor } from '@work/domain/value-objects/anchor.vo';
import type { Branch } from '@work/domain/value-objects/branch.vo';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';

const REVIEW_TRIGGERS = ['opened', 'mentioned', 'labelled'] as const;

export type ReviewTrigger = (typeof REVIEW_TRIGGERS)[number];

export const reviewTrigger = (raw: string): ReviewTrigger => {
  const trigger = REVIEW_TRIGGERS.find((each) => each === raw);

  if (!trigger) {
    throw new InvalidReviewRequestError(
      'must come from an opened pull request, a mention or a label',
    );
  }

  return trigger;
};

export interface ReviewRequest {
  readonly trigger: ReviewTrigger;
  readonly label: string | null;
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

export interface ReviewRequestReceived extends ReviewRequest {
  readonly anchor: Anchor | null;
  readonly ours: boolean;
}
