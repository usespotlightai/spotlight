import type {
  ReviewOutboxEntry,
  ReviewOutboxPort,
} from '@change-review/application/ports/review-outbox.port';
import { reviewOutbox } from '@change-review/infrastructure/persistence/drizzle/schemas/review.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, lte, sql } from 'drizzle-orm';

const FAILURE_LIMIT = 1_000;

@Injectable()
export class DrizzleReviewOutbox implements ReviewOutboxPort {
  constructor(private readonly context: DrizzleContext) {}

  async enqueue(
    sync: Omit<ReviewOutboxEntry, 'attempts'>,
    dueAt: Date,
  ): Promise<void> {
    await this.context.db.insert(reviewOutbox).values({
      id: sync.id,
      workspaceId: sync.workspaceId.value,
      taskId: sync.taskId.value,
      kind: sync.kind,
      subjectId: sync.subjectId,
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
          subjectId: found.subjectId,
          attempts: found.attempts,
        }
      : null;
  }

  async done(id: string): Promise<void> {
    await this.context.db
      .update(reviewOutbox)
      .set({ state: 'done', failure: null })
      .where(eq(reviewOutbox.id, id));
  }

  async later(
    id: string,
    dueAt: Date,
    failure: string | null,
    attempted: boolean,
  ): Promise<void> {
    await this.context.db
      .update(reviewOutbox)
      .set({
        dueAt,
        failure: failure?.slice(0, FAILURE_LIMIT) ?? null,
        attempts: attempted
          ? sql`${reviewOutbox.attempts} + 1`
          : reviewOutbox.attempts,
      })
      .where(eq(reviewOutbox.id, id));
  }

  async failed(id: string, failure: string): Promise<void> {
    await this.context.db
      .update(reviewOutbox)
      .set({
        state: 'failed',
        failure: failure.slice(0, FAILURE_LIMIT),
        attempts: sql`${reviewOutbox.attempts} + 1`,
      })
      .where(eq(reviewOutbox.id, id));
  }

  async failuresFor(taskId: TaskId): Promise<ReadonlyMap<string, string>> {
    const rows = await this.context.db
      .select({
        subjectId: reviewOutbox.subjectId,
        failure: reviewOutbox.failure,
      })
      .from(reviewOutbox)
      .where(
        and(
          eq(reviewOutbox.taskId, taskId.value),
          eq(reviewOutbox.state, 'failed'),
        ),
      );

    return new Map(
      rows.map((row) => [
        row.subjectId,
        row.failure ?? 'Spotlight couldn’t reach GitHub.',
      ]),
    );
  }

  async deleteTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(reviewOutbox)
      .where(eq(reviewOutbox.taskId, taskId.value));
  }
}
