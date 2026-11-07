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

export interface ReviewRequestParts {
  readonly trigger: ReviewTrigger;
  readonly label: string | null;
  readonly pullRequest: PullRequestUrl;
  readonly author: string | null;
  readonly outside: boolean;
  readonly draft: boolean;
  readonly branch: Branch | null;
}

export class ReviewRequest implements ReviewRequestParts {
  private constructor(
    readonly trigger: ReviewTrigger,
    readonly label: string | null,
    readonly pullRequest: PullRequestUrl,
    readonly author: string | null,
    readonly outside: boolean,
    readonly draft: boolean,
    readonly branch: Branch | null,
  ) {}

  static of(parts: ReviewRequestParts): ReviewRequest {
    if (
      !PullRequestLink.reviewing(parts.pullRequest, {
        outside: parts.outside,
      }).reviewedHead
    ) {
      throw new UnreviewablePullRequestError(parts.pullRequest.value);
    }

    return new ReviewRequest(
      parts.trigger,
      parts.label,
      parts.pullRequest,
      parts.author,
      parts.outside,
      parts.draft,
      parts.branch,
    );
  }

  with(changed: Partial<ReviewRequestParts>): ReviewRequest {
    return ReviewRequest.of({ ...this.parts, ...changed });
  }

  get parts(): ReviewRequestParts {
    return {
      trigger: this.trigger,
      label: this.label,
      pullRequest: this.pullRequest,
      author: this.author,
      outside: this.outside,
      draft: this.draft,
      branch: this.branch,
    };
  }
}

export interface ReviewRequestReceived extends ReviewRequestParts {
  readonly anchor: Anchor | null;
  readonly ours: boolean;
}
