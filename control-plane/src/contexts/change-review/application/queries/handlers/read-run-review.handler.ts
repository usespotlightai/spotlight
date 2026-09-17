import type {
  ReviewCommentDto,
  ReviewDto,
  RunReviewDto,
} from '@change-review/application/dto/run-review.dto';
import type { PeoplePort } from '@change-review/application/ports/people.port';
import type { ReviewOutboxPort } from '@change-review/application/ports/review-outbox.port';
import type {
  ReviewCommentView,
  ReviewReaderPort,
} from '@change-review/application/ports/review-reader.port';
import type { ReadRunReviewQuery } from '@change-review/application/queries/read-run-review.query';
import type { ReviewAccess } from '@change-review/application/services/review-access.service';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReadRunReviewHandler
  implements QueryHandlerPort<ReadRunReviewQuery, RunReviewDto>
{
  constructor(
    private readonly access: ReviewAccess,
    private readonly reader: ReviewReaderPort,
    private readonly outbox: ReviewOutboxPort,
    private readonly people: PeoplePort,
  ) {}

  async execute(query: ReadRunReviewQuery): Promise<RunReviewDto> {
    try {
      const { task, by } = await this.access.ofRun(
        query.teamId,
        query.runId,
        query.viewerId,
      );
      const failures = await this.outbox.failuresFor(task.id);
      const comments = await this.reader.commentsVisibleTo(task.id, by);
      const reviews = await this.reader.reviewsOf(task.id);
      const images = new Map<string, string | null>();

      for (const { authorId } of comments) {
        if (authorId && !images.has(authorId)) {
          images.set(
            authorId,
            (await this.people.find(UserId.of(authorId)))?.image ?? null,
          );
        }
      }

      const imageOf = (comment: ReviewCommentView): string | null =>
        comment.authorId
          ? (images.get(comment.authorId) ?? null)
          : comment.authorLogin
            ? `https://github.com/${encodeURIComponent(comment.authorLogin)}.png?size=64`
            : null;

      const failedWith = (id: string, reviewId: string | null) =>
        failures.get(id) ?? (reviewId ? failures.get(reviewId) : undefined);

      return {
        pullRequest: task.pullRequest?.value ?? null,
        comments: comments.map((comment): ReviewCommentDto => {
          const failure = failedWith(comment.id, comment.reviewId);

          return {
            id: comment.id,
            path: comment.path,
            side: comment.side,
            line: comment.line,
            startLine: comment.startLine,
            body: comment.body,
            authorName: comment.authorName,
            authorLogin: comment.authorLogin,
            authorImage: imageOf(comment),
            yours: comment.authorId === by.value,
            replyTo: comment.replyTo,
            state:
              comment.state === 'draft'
                ? 'draft'
                : comment.state === 'posted'
                  ? 'posted'
                  : comment.state === 'failed' || failure
                    ? 'failed'
                    : 'sending',
            failure:
              comment.state === 'submitted' || comment.state === 'failed'
                ? (failure ?? null)
                : null,
            url: comment.url,
            createdAt: comment.createdAt.toISOString(),
            editedAt: comment.editedAt?.toISOString() ?? null,
          };
        }),
        reviews: await Promise.all(
          reviews.map(async (review): Promise<ReviewDto> => {
            const failure = failures.get(review.id) ?? null;

            return {
              id: review.id,
              authorName:
                (await this.people.find(UserId.of(review.authorId)))?.name ??
                'Someone',
              yours: review.authorId === by.value,
              verdict: review.verdict,
              body: review.body,
              state:
                review.state === 'posted'
                  ? 'posted'
                  : review.state === 'failed' || failure
                    ? 'failed'
                    : 'sending',
              failure: review.state === 'posted' ? null : failure,
              submittedAt: review.submittedAt.toISOString(),
            };
          }),
        ),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
