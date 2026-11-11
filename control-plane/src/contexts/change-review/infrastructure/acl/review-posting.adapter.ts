import { ReviewPostingFailedError } from '@change-review/application/errors/review-posting-failed.error';
import type {
  PostedReview,
  PostingTarget,
  ReviewPoster,
  ReviewPostingPort,
} from '@change-review/application/ports/review-posting.port';
import type { OnGitHub } from '@change-review/domain/aggregates/review-comment.aggregate';
import type { ReviewVerdict } from '@change-review/domain/aggregates/review.aggregate';
import { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import { GitHubUnansweredError } from '@github/application/errors/github-unanswered.error';
import type {
  OnPullRequest,
  PullRequestReviewsPort,
  ReviewActor,
  ReviewEvent,
} from '@github/application/ports/pull-request-reviews.port';
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

const EVENT_OF: Record<ReviewVerdict, ReviewEvent> = {
  comment: 'comment',
  approve: 'approve',
  'request-changes': 'request-changes',
};

const VERDICT_OF: Record<ReviewEvent, ReviewVerdict> = {
  comment: 'comment',
  approve: 'approve',
  'request-changes': 'request-changes',
};

const actorOf = (poster: ReviewPoster): ReviewActor =>
  poster.kind === 'person'
    ? { kind: 'person', userId: poster.userId, name: poster.name }
    : { kind: 'spotlight' };

const onPullRequest = (target: PostingTarget): OnPullRequest => ({
  workspaceId: target.workspaceId,
  pullRequest: target.pullRequest,
  by: actorOf(target.by),
});

const placed = (github: { id: number; url: string }): OnGitHub => ({
  id: github.id,
  url: github.url,
});

export class GitHubReviewPosting implements ReviewPostingPort {
  constructor(private readonly github: PullRequestReviewsPort) {}

  async submit(
    input: Parameters<ReviewPostingPort['submit']>[0],
  ): Promise<PostedReview> {
    const submitted = await posted(() =>
      this.github.submit({
        ...onPullRequest(input),
        event: EVENT_OF[input.verdict],
        body: input.body,
        comments: input.comments.map((comment) => ({
          path: comment.path,
          side: comment.side,
          line: comment.line,
          startLine: comment.startLine,
          body: comment.body,
        })),
      }),
    );

    return {
      githubId: submitted.githubId,
      verdict: VERDICT_OF[submitted.postedAs],
      comments: submitted.comments.map((each) => each && placed(each)),
    };
  }

  async reply(input: Parameters<ReviewPostingPort['reply']>[0]) {
    return placed(
      await posted(() =>
        this.github.reply({
          ...onPullRequest(input),
          to: input.thread,
          body: input.body,
        }),
      ),
    );
  }

  async commentOnFile(
    input: Parameters<ReviewPostingPort['commentOnFile']>[0],
  ) {
    return placed(
      await posted(() =>
        this.github.commentOnFile({
          ...onPullRequest(input),
          path: input.path,
          body: input.body,
        }),
      ),
    );
  }

  edit(input: Parameters<ReviewPostingPort['edit']>[0]) {
    return posted(() =>
      this.github.edit({
        ...onPullRequest(input),
        commentId: input.commentId,
        body: input.body,
      }),
    );
  }

  remove(input: Parameters<ReviewPostingPort['remove']>[0]) {
    return posted(() =>
      this.github.remove({
        ...onPullRequest(input),
        commentId: input.commentId,
      }),
    );
  }
}
