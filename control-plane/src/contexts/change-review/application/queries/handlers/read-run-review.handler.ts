import type {
  DeliveryFailureDto,
  ReviewCommentDto,
  ReviewDto,
  RunReviewDto,
} from '@change-review/application/dto/run-review.dto';
import type { AvatarsPort } from '@change-review/application/ports/avatars.port';
import type { PeoplePort } from '@change-review/application/ports/people.port';
import type {
  ReviewCommentView,
  ReviewReaderPort,
  ReviewView,
} from '@change-review/application/ports/review-reader.port';
import type { ReadRunReviewQuery } from '@change-review/application/queries/read-run-review.query';
import type { TeamWorkAccess } from '@change-review/application/services/team-work-access.service';
import { commentVisibleTo } from '@change-review/domain/services/comment-visibility';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import type { DeliveryFailureCode } from '@change-review/domain/value-objects/delivery-failure.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const authorOf = (view: {
  readonly authorId: string | null;
  readonly authorRunId: string | null;
  readonly authorLogin?: string | null;
  readonly authorName: string | null;
}): ReviewAuthor =>
  ReviewAuthor.rehydrate({
    userId: view.authorId ? UserId.of(view.authorId) : null,
    runId: view.authorRunId ? RunId.of(view.authorRunId) : null,
    login: view.authorLogin ?? null,
    name: AuthorName.of(view.authorName),
  });

const failureOf = (view: {
  readonly failureCode: DeliveryFailureCode | null;
  readonly failureDetail: string | null;
}): DeliveryFailureDto | null =>
  view.failureCode
    ? { code: view.failureCode, detail: view.failureDetail }
    : null;

const stateOf = (
  state: ReviewCommentView['state'] | ReviewView['state'],
): ReviewCommentDto['state'] => {
  switch (state) {
    case 'draft':
    case 'posted':
    case 'failed':
      return state;
    default:
      return 'sending';
  }
};

export class ReadRunReviewHandler
  implements QueryHandlerPort<ReadRunReviewQuery, RunReviewDto>
{
  constructor(
    private readonly access: TeamWorkAccess,
    private readonly reader: ReviewReaderPort,
    private readonly people: PeoplePort,
    private readonly avatars: AvatarsPort,
  ) {}

  async execute(query: ReadRunReviewQuery): Promise<RunReviewDto> {
    try {
      const { task, by } = await this.access.reviewing(
        query.teamId,
        query.runId,
        query.viewerId,
      );
      const comments = (await this.reader.commentsOf(task.id))
        .map((view) => ({ view, author: authorOf(view) }))
        .filter(({ view, author }) =>
          commentVisibleTo({ state: view.state, author }, by),
        );
      const reviews = await this.reader.reviewsOf(task.id);
      const images = new Map<string, string | null>();

      for (const { author } of comments) {
        const userId = author.userId;

        if (userId && !images.has(userId.value)) {
          images.set(
            userId.value,
            (await this.people.find(userId))?.image ?? null,
          );
        }
      }

      const imageOf = (author: ReviewAuthor): string | null =>
        author.userId
          ? (images.get(author.userId.value) ?? null)
          : author.login
            ? this.avatars.pictureOf(author.login)
            : null;

      return {
        pullRequest: task.pullRequest?.value ?? null,
        comments: comments.map(
          ({ view, author }): ReviewCommentDto => ({
            id: view.id,
            path: view.path,
            side: view.side,
            line: view.line,
            startLine: view.startLine,
            body: view.body,
            authorName: author.name.value,
            authorLogin: author.login,
            authorImage: imageOf(author),
            viewerIsAuthor: author.userId?.equals(by) ?? false,
            isAgentAuthored: author.kind === 'agent',
            replyTo: view.replyTo,
            state: stateOf(view.state),
            failure: failureOf(view),
            url: view.url,
            createdAt: view.createdAt.toISOString(),
            editedAt: view.editedAt?.toISOString() ?? null,
          }),
        ),
        reviews: await Promise.all(
          reviews.map(async (review): Promise<ReviewDto> => {
            const author = authorOf(review);
            const person = author.userId
              ? await this.people.find(author.userId)
              : null;

            return {
              id: review.id,
              authorName: author.userId
                ? AuthorName.of(person?.name ?? null).value
                : author.name.value,
              viewerIsAuthor: author.userId?.equals(by) ?? false,
              isAgentAuthored: author.kind === 'agent',
              verdict: review.verdict,
              body: review.body,
              state: stateOf(review.state),
              failure: failureOf(review),
              submittedAt: review.submittedAt.toISOString(),
            };
          }),
        ),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
