import { InvalidReviewError } from '@change-review/domain/exceptions/invalid-review.error';

export interface ReviewTarget {
  readonly pullRequest: unknown;
  readonly reviewing: boolean;
}

export function assertAgentMayReview<T extends ReviewTarget>(
  task: T | null,
): asserts task is T {
  if (!task?.pullRequest || !task.reviewing) {
    throw new InvalidReviewError(
      'is left by an agent only on a pull request its task reviews',
    );
  }
}
