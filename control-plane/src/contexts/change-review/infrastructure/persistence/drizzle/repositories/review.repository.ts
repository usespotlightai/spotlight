import { Review } from '@change-review/domain/aggregates/review.aggregate';
import { ReviewVersionConflictError } from '@change-review/domain/exceptions/review-version-conflict.error';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { review } from '@change-review/infrastructure/persistence/drizzle/schemas/review.schema';
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
import { and, eq } from 'drizzle-orm';

type Row = typeof review.$inferSelect;

const toReview = (row: Row): Review =>
  Review.rehydrate({
    id: ReviewId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    taskId: TaskId.of(row.taskId),
    author: ReviewAuthor.rehydrate({
      userId: row.authorId ? UserId.of(row.authorId) : null,
      runId: row.authorRunId ? RunId.of(row.authorRunId) : null,
      login: null,
      name: AuthorName.of(row.authorName),
    }),
    verdict: row.verdict,
    body: row.body,
    comments: row.commentIds.map((each) => ReviewCommentId.of(each)),
    state: row.state,
    githubId: row.githubId,
    submittedAt: row.submittedAt,
    postedAt: row.postedAt,
    version: row.version,
  });

const toRow = (aggregate: Review): Row => ({
  id: aggregate.id.value,
  workspaceId: aggregate.workspaceId.value,
  taskId: aggregate.taskId.value,
  authorId: aggregate.author.userId?.value ?? null,
  authorRunId: aggregate.author.runId?.value ?? null,
  authorName: aggregate.author.name.value,
  verdict: aggregate.verdict,
  body: aggregate.body,
  commentIds: aggregate.comments.map((each) => each.value),
  state: aggregate.state,
  githubId: aggregate.githubId,
  submittedAt: aggregate.submittedAt,
  postedAt: aggregate.postedAt,
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

    return row ? toReview(row) : null;
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db.delete(review).where(eq(review.taskId, taskId.value));
  }
}
