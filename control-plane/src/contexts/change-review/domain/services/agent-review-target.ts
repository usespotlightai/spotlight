import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';

export interface ReviewTarget {
  readonly reviewedPullRequest: PullRequestUrl | null;
}

export function assertAgentMayReview<T extends ReviewTarget>(
  task: T | null,
): asserts task is T {
  if (!task?.reviewedPullRequest) {
    throw new InvalidReviewError(
      'is left by an agent only on a pull request its task reviews',
    );
  }
}
