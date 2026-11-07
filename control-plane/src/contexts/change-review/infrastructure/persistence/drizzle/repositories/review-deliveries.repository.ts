import type {
  LeasedReviewDelivery,
  ReviewDeliveriesPort,
  ReviewDelivery,
  ReviewDeliveryKind,
  ReviewDeliverySubject,
} from '@change-review/application/ports/review-deliveries.port';
import type { DeliveryRetry } from '@change-review/domain/value-objects/delivery-attempts.vo';
import { ReviewCommentId } from '@change-review/domain/value-objects/review-comment-id.vo';
import { ReviewDeliveryId } from '@change-review/domain/value-objects/review-delivery-id.vo';
import { ReviewId } from '@change-review/domain/value-objects/review-id.vo';
import { reviewDelivery } from '@change-review/infrastructure/persistence/drizzle/schemas/review.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, lte, sql } from 'drizzle-orm';

const subjectColumns = (delivery: ReviewDeliverySubject) =>
  delivery.kind === 'review'
    ? { reviewId: delivery.subject.value, commentId: null }
    : { reviewId: null, commentId: delivery.subject.value };

const subjectOf = (row: {
  readonly kind: ReviewDeliveryKind;
  readonly reviewId: string | null;
  readonly commentId: string | null;
}): ReviewDeliverySubject => {
  if (row.kind === 'review' && row.reviewId !== null) {
    return { kind: row.kind, subject: ReviewId.of(row.reviewId) };
  }

  if (row.kind !== 'review' && row.commentId !== null) {
    return { kind: row.kind, subject: ReviewCommentId.of(row.commentId) };
  }

  throw new InconsistentStateError('review delivery', 'has no subject');
};

const leasedBy = (delivery: LeasedReviewDelivery) =>
  and(
    eq(reviewDelivery.id, delivery.id.value),
    eq(reviewDelivery.state, 'pending'),
    eq(reviewDelivery.dueAt, delivery.leaseUntil),
  );

@Injectable()
export class DrizzleReviewDeliveries implements ReviewDeliveriesPort {
  constructor(private readonly context: DrizzleContext) {}

  async enqueue(delivery: ReviewDelivery, dueAt: Date): Promise<void> {
    await this.context.db.insert(reviewDelivery).values({
      id: delivery.id.value,
      workspaceId: delivery.workspaceId.value,
      taskId: delivery.taskId.value,
      kind: delivery.kind,
      ...subjectColumns(delivery),
      dueAt,
    });
  }

  async leaseDue(
    now: Date,
    leaseUntil: Date,
  ): Promise<LeasedReviewDelivery | null> {
    const found = await this.context.inTransaction(async () => {
      const [due] = await this.context.db
        .select()
        .from(reviewDelivery)
        .where(
          and(
            eq(reviewDelivery.state, 'pending'),
            lte(reviewDelivery.dueAt, now),
          ),
        )
        .orderBy(asc(reviewDelivery.dueAt))
        .limit(1)
        .for('update', { skipLocked: true });

      if (due) {
        await this.context.db
          .update(reviewDelivery)
          .set({ dueAt: leaseUntil })
          .where(eq(reviewDelivery.id, due.id));
      }

      return due ?? null;
    });

    return found
      ? {
          id: ReviewDeliveryId.of(found.id),
          workspaceId: WorkspaceId.of(found.workspaceId),
          taskId: TaskId.of(found.taskId),
          ...subjectOf(found),
          attempts: found.attempts,
          leaseUntil,
          sendingSince: found.sendingSince,
        }
      : null;
  }

  async sending(delivery: LeasedReviewDelivery, at: Date): Promise<void> {
    await this.context.db
      .update(reviewDelivery)
      .set({ sendingSince: at })
      .where(leasedBy(delivery));
  }

  async delivered(delivery: LeasedReviewDelivery): Promise<void> {
    await this.context.db
      .update(reviewDelivery)
      .set({ state: 'done' })
      .where(leasedBy(delivery));
  }

  async retry(
    delivery: LeasedReviewDelivery,
    retry: DeliveryRetry,
  ): Promise<void> {
    await this.context.db
      .update(reviewDelivery)
      .set({
        dueAt: retry.at,
        sendingSince: null,
        attempts: retry.counted
          ? sql`${reviewDelivery.attempts} + 1`
          : reviewDelivery.attempts,
      })
      .where(leasedBy(delivery));
  }

  async failed(delivery: LeasedReviewDelivery): Promise<void> {
    await this.context.db
      .update(reviewDelivery)
      .set({
        state: 'failed',
        attempts: sql`${reviewDelivery.attempts} + 1`,
      })
      .where(leasedBy(delivery));
  }

  async dropTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(reviewDelivery)
      .where(eq(reviewDelivery.taskId, taskId.value));
  }
}
