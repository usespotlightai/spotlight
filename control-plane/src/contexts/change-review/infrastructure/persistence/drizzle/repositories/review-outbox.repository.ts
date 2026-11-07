import type {
  ReviewDelivery,
  ReviewOutboxEntry,
  ReviewOutboxKind,
  ReviewOutboxPort,
} from '@change-review/application/ports/review-outbox.port';
import { reviewOutbox } from '@change-review/infrastructure/persistence/drizzle/schemas/review.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, lte, sql } from 'drizzle-orm';

const subjectColumns = (kind: ReviewOutboxKind, subjectId: string) =>
  kind === 'review'
    ? { reviewId: subjectId, commentId: null }
    : { reviewId: null, commentId: subjectId };

const subjectOf = (row: {
  readonly reviewId: string | null;
  readonly commentId: string | null;
}): string => {
  const subject = row.reviewId ?? row.commentId;

  if (subject === null) {
    throw new InconsistentStateError('review outbox entry', 'has no subject');
  }

  return subject;
};

const leasedBy = (entry: ReviewOutboxEntry) =>
  and(
    eq(reviewOutbox.id, entry.id),
    eq(reviewOutbox.state, 'pending'),
    eq(reviewOutbox.dueAt, entry.leaseUntil),
  );

@Injectable()
export class DrizzleReviewOutbox implements ReviewOutboxPort {
  constructor(private readonly context: DrizzleContext) {}

  async enqueue(delivery: ReviewDelivery, dueAt: Date): Promise<void> {
    await this.context.db.insert(reviewOutbox).values({
      id: delivery.id,
      workspaceId: delivery.workspaceId.value,
      taskId: delivery.taskId.value,
      kind: delivery.kind,
      ...subjectColumns(delivery.kind, delivery.subjectId),
      dueAt,
    });
  }

  async claimDue(
    now: Date,
    leaseUntil: Date,
  ): Promise<ReviewOutboxEntry | null> {
    const found = await this.context.inTransaction(async () => {
      const [due] = await this.context.db
        .select()
        .from(reviewOutbox)
        .where(
          and(eq(reviewOutbox.state, 'pending'), lte(reviewOutbox.dueAt, now)),
        )
        .orderBy(asc(reviewOutbox.dueAt))
        .limit(1)
        .for('update', { skipLocked: true });

      if (due) {
        await this.context.db
          .update(reviewOutbox)
          .set({ dueAt: leaseUntil })
          .where(eq(reviewOutbox.id, due.id));
      }

      return due ?? null;
    });

    return found
      ? {
          id: found.id,
          workspaceId: WorkspaceId.of(found.workspaceId),
          taskId: TaskId.of(found.taskId),
          kind: found.kind,
          subjectId: subjectOf(found),
          attempts: found.attempts,
          leaseUntil,
        }
      : null;
  }

  async done(entry: ReviewOutboxEntry): Promise<void> {
    await this.context.db
      .update(reviewOutbox)
      .set({ state: 'done' })
      .where(leasedBy(entry));
  }

  async later(
    entry: ReviewOutboxEntry,
    dueAt: Date,
    attempted: boolean,
  ): Promise<void> {
    await this.context.db
      .update(reviewOutbox)
      .set({
        dueAt,
        attempts: attempted
          ? sql`${reviewOutbox.attempts} + 1`
          : reviewOutbox.attempts,
      })
      .where(leasedBy(entry));
  }

  async failed(entry: ReviewOutboxEntry): Promise<void> {
    await this.context.db
      .update(reviewOutbox)
      .set({
        state: 'failed',
        attempts: sql`${reviewOutbox.attempts} + 1`,
      })
      .where(leasedBy(entry));
  }

  async dropTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(reviewOutbox)
      .where(eq(reviewOutbox.taskId, taskId.value));
  }
}
