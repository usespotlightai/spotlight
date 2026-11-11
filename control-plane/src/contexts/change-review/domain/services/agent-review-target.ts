import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';

export interface ReviewTarget {
  readonly reviewedPullRequest: unknown;
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
