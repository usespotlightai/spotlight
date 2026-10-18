import { ReviewComment } from '@change-review/domain/aggregates/review-comment.aggregate';
import { ReviewCommentVersionConflictError } from '@change-review/domain/exceptions/review-comment-version-conflict.error';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import { AuthorName } from '@change-review/domain/value-objects/author-name.vo';
import type { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { ReviewAnchor } from '@change-review/domain/value-objects/review-anchor.vo';
import { ReviewAuthor } from '@change-review/domain/value-objects/review-author.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { reviewComment } from '@change-review/infrastructure/persistence/drizzle/schemas/review.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, isNotNull, isNull, sql } from 'drizzle-orm';

type Row = typeof reviewComment.$inferSelect;

const anchorOf = (row: Row): ReviewAnchor => {
  if (row.side === null && row.line === null && row.startLine === null) {
    return ReviewAnchor.onFile(row.path);
  }

  if (row.side === null || row.line === null) {
    throw new InconsistentStateError(
      'review comment',
      'is on lines without saying which side or line',
    );
  }

  return ReviewAnchor.onLines({
    path: row.path,
    side: row.side,
    line: row.line,
    startLine: row.startLine,
  });
};

const toComment = (row: Row): ReviewComment =>
  ReviewComment.rehydrate({
    id: ReviewCommentId.of(row.id),
    workspaceId: WorkspaceId.of(row.workspaceId),
    taskId: TaskId.of(row.taskId),
    anchor: anchorOf(row),
    body: row.body,
    author: ReviewAuthor.rehydrate({
      userId: row.authorId ? UserId.of(row.authorId) : null,
      runId: row.authorRunId ? RunId.of(row.authorRunId) : null,
      login: row.authorLogin,
      name: AuthorName.of(row.authorName),
    }),
    replyTo: row.replyToId ? ReviewCommentId.of(row.replyToId) : null,
    reviewId: row.reviewId ? ReviewId.of(row.reviewId) : null,
    state: row.state,
    github:
      row.githubId !== null && row.githubUrl
        ? { id: row.githubId, url: row.githubUrl }
        : null,
    sentBody: row.sentBody,
    editPending: row.editPending,
    pendingOwnEdits: row.pendingOwnEdits,
    createdAt: row.createdAt,
    editedAt: row.editedAt,
    version: row.version,
  });

const toRow = (comment: ReviewComment): Row => ({
  id: comment.id.value,
  workspaceId: comment.workspaceId.value,
  taskId: comment.taskId.value,
  path: comment.anchor.path.value,
  side: comment.anchor.lines?.side ?? null,
  line: comment.anchor.lines?.line ?? null,
  startLine: comment.anchor.lines?.startLine ?? null,
  body: comment.body,
  authorId: comment.author.userId?.value ?? null,
  authorRunId: comment.author.runId?.value ?? null,
  authorLogin: comment.author.login,
  authorName: comment.author.name.value,
  replyToId: comment.replyTo?.value ?? null,
  reviewId: comment.reviewId?.value ?? null,
  state: comment.state,
  githubId: comment.github?.id ?? null,
  githubUrl: comment.github?.url ?? null,
  sentBody: comment.sentBody,
  editPending: comment.editPending,
  pendingOwnEdits: [...comment.pendingOwnEdits],
  createdAt: comment.createdAt,
  editedAt: comment.editedAt,
  version: comment.version,
});

@Injectable()
export class DrizzleReviewCommentRepository implements ReviewCommentRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(comment: ReviewComment): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.context.db.insert(reviewComment).values(toRow(comment));
      await this.events.dispatch(comment.pullEvents());
    });
  }

  async save(comment: ReviewComment): Promise<void> {
    await this.context.inTransaction(async () => {
      await this.stored(comment);
      await this.events.dispatch(comment.pullEvents());
    });
  }

  private async stored(comment: ReviewComment): Promise<void> {
    const { id, version, ...changed } = toRow(comment);

    const written = await this.context.db
      .update(reviewComment)
      .set({ ...changed, version: version + 1 })
      .where(and(eq(reviewComment.id, id), eq(reviewComment.version, version)))
      .returning({ id: reviewComment.id });

    if (written.length === 0) {
      throw new ReviewCommentVersionConflictError(id);
    }
  }

  async find(id: ReviewCommentId): Promise<ReviewComment | null> {
    const [row] = await this.context.db
      .select()
      .from(reviewComment)
      .where(eq(reviewComment.id, id.value))
      .limit(1);

    return row ? toComment(row) : null;
  }

  async onGitHub(
    workspaceId: WorkspaceId,
    githubId: number,
  ): Promise<ReviewComment | null> {
    const [row] = await this.context.db
      .select()
      .from(reviewComment)
      .where(
        and(
          eq(reviewComment.workspaceId, workspaceId.value),
          eq(reviewComment.githubId, githubId),
        ),
      )
      .limit(1);

    return row ? toComment(row) : null;
  }

  async draftsBy(
    taskId: TaskId,
    author: ReviewAuthor,
  ): Promise<ReviewComment[]> {
    const written = author.userId
      ? eq(reviewComment.authorId, author.userId.value)
      : author.kind === 'agent'
        ? and(
            isNull(reviewComment.authorId),
            isNotNull(reviewComment.authorRunId),
          )
        : null;

    if (!written) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(reviewComment)
      .where(
        and(
          eq(reviewComment.taskId, taskId.value),
          written,
          eq(reviewComment.state, 'draft'),
        ),
      )
      .orderBy(asc(reviewComment.createdAt));

    return rows.map(toComment);
  }

  async ofTask(taskId: TaskId): Promise<ReviewComment[]> {
    const rows = await this.context.db
      .select()
      .from(reviewComment)
      .where(eq(reviewComment.taskId, taskId.value))
      .orderBy(asc(reviewComment.createdAt));

    return rows.map(toComment);
  }

  async lockThreadsOnFile(taskId: TaskId, path: FilePath): Promise<void> {
    if (!this.context.transacting) {
      throw new Error('Locking the threads on a file needs a transaction');
    }

    await this.context.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`review-file:${taskId.value}:${path.value}`}, 0))`,
    );
  }

  async threadsOnFile(
    taskId: TaskId,
    path: FilePath,
  ): Promise<ReviewComment[]> {
    const rows = await this.context.db
      .select()
      .from(reviewComment)
      .where(
        and(
          eq(reviewComment.taskId, taskId.value),
          eq(reviewComment.path, path.value),
          isNull(reviewComment.line),
          isNull(reviewComment.replyToId),
        ),
      )
      .orderBy(asc(reviewComment.createdAt));

    return rows.map(toComment);
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(reviewComment)
      .where(eq(reviewComment.taskId, taskId.value));
  }
}
