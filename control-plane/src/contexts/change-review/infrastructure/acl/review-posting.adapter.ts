import { ReviewPostingFailedError } from '@change-review/application/errors/review-posting-failed.error';
import type { ReviewPostingPort } from '@change-review/application/ports/review-posting.port';
import { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import { GitHubUnansweredError } from '@github/application/errors/github-unanswered.error';
import type { PullRequestReviewsPort } from '@github/application/ports/pull-request-reviews.port';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';

const failureOf = (error: UpstreamError): DeliveryFailure =>
  error.retryable
    ? DeliveryFailure.of('github-unreachable')
    : DeliveryFailure.of('github-rejected', error.message);

const posted = async <T>(call: () => Promise<T>): Promise<T> => {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof UpstreamError)) {
      throw error;
    }

    throw new ReviewPostingFailedError(failureOf(error), {
      cause: error,
      outcomeUnknown: error instanceof GitHubUnansweredError,
    });
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
