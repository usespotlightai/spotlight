import { ReviewPostingFailedError } from '@change-review/application/errors/review-posting-failed.error';
import type { ReviewPostingPort } from '@change-review/application/ports/review-posting.port';
import { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import type { PullRequestReviewsPort } from '@github/application/ports/pull-request-reviews.port';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';

const UNREACHABLE_NAMES = new Set(['TimeoutError', 'AbortError']);

const unreachable = (error: unknown): boolean =>
  (error instanceof TypeError && error.message === 'fetch failed') ||
  (error instanceof Error && UNREACHABLE_NAMES.has(error.name));

const failureOf = (error: unknown): DeliveryFailure | null => {
  if (error instanceof UpstreamError) {
    return error.retryable
      ? DeliveryFailure.of('github-unreachable')
      : DeliveryFailure.of('github-rejected', error.message);
  }

  return unreachable(error) ? DeliveryFailure.of('github-unreachable') : null;
};

const posted = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    const failure = failureOf(error);

    throw failure ? new ReviewPostingFailedError(failure, error) : error;
  }
};

export class GitHubReviewPosting implements ReviewPostingPort {
  constructor(private readonly github: PullRequestReviewsPort) {}

  submit(input: Parameters<PullRequestReviewsPort['submit']>[0]) {
    return posted(() => this.github.submit(input));
  }

  reply(input: Parameters<PullRequestReviewsPort['reply']>[0]) {
    return posted(() => this.github.reply(input));
  }

  commentOnFile(input: Parameters<PullRequestReviewsPort['commentOnFile']>[0]) {
    return posted(() => this.github.commentOnFile(input));
  }

  edit(input: Parameters<PullRequestReviewsPort['edit']>[0]) {
    return posted(() => this.github.edit(input));
  }

  remove(input: Parameters<PullRequestReviewsPort['remove']>[0]) {
    return posted(() => this.github.remove(input));
  }
}
