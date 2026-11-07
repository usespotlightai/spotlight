import type {
  LeasedReviewDelivery,
  ReviewDeliveriesPort,
  ReviewDelivery,
  ReviewDeliveryKind,
} from '@change-review/application/ports/review-deliveries.port';
import type { DeliveryRetry } from '@change-review/domain/value-objects/delivery-attempts.vo';
import { reviewDelivery } from '@change-review/infrastructure/persistence/drizzle/schemas/review.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, lte, sql } from 'drizzle-orm';

const subjectColumns = (kind: ReviewDeliveryKind, subjectId: string) =>
  kind === 'review'
    ? { reviewId: subjectId, commentId: null }
    : { reviewId: null, commentId: subjectId };

const subjectOf = (row: {
  readonly reviewId: string | null;
  readonly commentId: string | null;
}): string => {
  const subject = row.reviewId ?? row.commentId;

  if (subject === null) {
    throw new InconsistentStateError('review delivery', 'has no subject');
  }

  return subject;
};

const leasedBy = (delivery: LeasedReviewDelivery) =>
  and(
    eq(reviewDelivery.id, delivery.id),
    eq(reviewDelivery.state, 'pending'),
    eq(reviewDelivery.dueAt, delivery.leaseUntil),
  );

@Injectable()
export class DrizzleReviewDeliveries implements ReviewDeliveriesPort {
  constructor(private readonly context: DrizzleContext) {}

  async enqueue(delivery: ReviewDelivery, dueAt: Date): Promise<void> {
    await this.context.db.insert(reviewDelivery).values({
      id: delivery.id,
      workspaceId: delivery.workspaceId.value,
      taskId: delivery.taskId.value,
      kind: delivery.kind,
      ...subjectColumns(delivery.kind, delivery.subjectId),
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
