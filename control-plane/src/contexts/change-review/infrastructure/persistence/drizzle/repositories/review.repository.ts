import { Review } from '@change-review/domain/aggregates/review.aggregate';
import { ReviewVersionConflictError } from '@change-review/domain/exceptions/review-version-conflict.error';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { DeliveryFailure } from '@change-review/domain/value-objects/delivery-failure.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import {
  review,
  reviewIncludedComment,
} from '@change-review/infrastructure/persistence/drizzle/schemas/review.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq } from 'drizzle-orm';

type Row = typeof review.$inferSelect;

const toReview = (row: Row, comments: readonly string[]): Review =>
  Review.rehydrate({
    id: ReviewId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    taskId: TaskId.of(row.taskId),
    repository: RepositoryName.optional(row.repository),
    author: ReviewAuthor.rehydrate({
      userId: row.authorId ? UserId.of(row.authorId) : null,
      runId: row.authorRunId ? RunId.of(row.authorRunId) : null,
      login: null,
      name: AuthorName.of(row.authorName),
    }),
    verdict: row.verdict,
    body: row.body,
    comments: comments.map((each) => ReviewCommentId.of(each)),
    state: row.state,
    githubId: row.githubId,
    verdictOnGitHub: row.verdictOnGitHub,
    submittedAt: row.submittedAt,
    postedAt: row.postedAt,
    failure: row.failureCode
      ? DeliveryFailure.rehydrate(row.failureCode, row.failureDetail)
      : null,
    version: row.version,
  });

const toRow = (aggregate: Review): Row => ({
  id: aggregate.id.value,
  workspaceId: aggregate.workspaceId.value,
  taskId: aggregate.taskId.value,
  repository: aggregate.repository?.value ?? null,
  authorId: aggregate.author.userId?.value ?? null,
  authorRunId: aggregate.author.runId?.value ?? null,
  authorName: aggregate.author.name.value,
  verdict: aggregate.verdict,
  body: aggregate.body,
  state: aggregate.state,
  githubId: aggregate.githubId,
  verdictOnGitHub: aggregate.verdictOnGitHub,
  submittedAt: aggregate.submittedAt,
  postedAt: aggregate.postedAt,
  failureCode: aggregate.failure?.code ?? null,
  failureDetail: aggregate.failure?.detail ?? null,
  version: aggregate.version,
});

@Injectable()
export class DrizzleReviewRepository implements ReviewRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Review): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.inserted(added);
      await this.events.dispatch(added.pullEvents());
    });
  }

  private async inserted(added: Review): Promise<void> {
    await this.context.db.insert(review).values(toRow(added));

    if (added.comments.length > 0) {
      await this.context.db.insert(reviewIncludedComment).values(
        added.comments.map((each, position) => ({
          reviewId: added.id.value,
          workspaceId: added.workspaceId.value,
          commentId: each.value,
          position,
        })),
      );
    }
  }

  async save(saved: Review): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(saved);
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async stored(saved: Review): Promise<void> {
    const { id, version, ...changed } = toRow(saved);

    const written = await this.context.db
      .update(review)
      .set({ ...changed, version: version + 1 })
      .where(and(eq(review.id, id), eq(review.version, version)))
      .returning({ id: review.id });

    if (written.length === 0) {
      throw new ReviewVersionConflictError(id);
    }
  }

  async find(id: ReviewId): Promise<Review | null> {
    const [row] = await this.context.db
      .select()
      .from(review)
      .where(eq(review.id, id.value))
      .limit(1);

    return row ? this.withComments(row) : null;
  }

  async ofTask(taskId: TaskId): Promise<readonly Review[]> {
    const rows = await this.context.db
      .select()
      .from(review)
      .where(eq(review.taskId, taskId.value));

    return Promise.all(rows.map((row) => this.withComments(row)));
  }

  async remove(removed: Review): Promise<void> {
    await this.context.inTransaction(async () => {
      const deleted = await this.context.db
        .delete(review)
        .where(
          and(
            eq(review.id, removed.id.value),
            eq(review.version, removed.version),
          ),
        )
        .returning({ id: review.id });

      if (deleted.length === 0) {
        throw new ReviewVersionConflictError(removed.id.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  private async withComments(row: Row): Promise<Review> {
    const included = await this.context.db
      .select({ commentId: reviewIncludedComment.commentId })
      .from(reviewIncludedComment)
      .where(eq(reviewIncludedComment.reviewId, row.id))
      .orderBy(asc(reviewIncludedComment.position));

    return toReview(
      row,
      included.map((each) => each.commentId),
    );
  }
}
