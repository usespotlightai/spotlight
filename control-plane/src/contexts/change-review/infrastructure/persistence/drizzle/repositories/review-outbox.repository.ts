import type {
  ReviewOutboxPort,
  ReviewSync,
} from '@change-review/application/ports/review-outbox.port';
import { reviewSync } from '@change-review/infrastructure/persistence/drizzle/schemas/review.schema';
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
    sync: Omit<ReviewSync, 'attempts'>,
    dueAt: Date,
  ): Promise<void> {
    await this.context.db.insert(reviewSync).values({
      id: sync.id,
      workspaceId: sync.workspaceId.value,
      taskId: sync.taskId.value,
      kind: sync.kind,
      subjectId: sync.subjectId,
      dueAt,
    });
  }

  async claimDue(now: Date, leaseUntil: Date): Promise<ReviewSync | null> {
    const found = await this.context.inTransaction(async () => {
      const [due] = await this.context.db
        .select()
        .from(reviewSync)
        .where(and(eq(reviewSync.state, 'pending'), lte(reviewSync.dueAt, now)))
        .orderBy(asc(reviewSync.dueAt))
        .limit(1)
        .for('update', { skipLocked: true });

      if (due) {
        await this.context.db
          .update(reviewSync)
          .set({ dueAt: leaseUntil })
          .where(eq(reviewSync.id, due.id));
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
      .update(reviewSync)
      .set({ state: 'done', failure: null })
      .where(eq(reviewSync.id, id));
  }

  async later(
    id: string,
    dueAt: Date,
    failure: string | null,
    attempted: boolean,
  ): Promise<void> {
    await this.context.db
      .update(reviewSync)
      .set({
        dueAt,
        failure: failure?.slice(0, FAILURE_LIMIT) ?? null,
        attempts: attempted
          ? sql`${reviewSync.attempts} + 1`
          : reviewSync.attempts,
      })
      .where(eq(reviewSync.id, id));
  }

  async failed(id: string, failure: string): Promise<void> {
    await this.context.db
      .update(reviewSync)
      .set({
        state: 'failed',
        failure: failure.slice(0, FAILURE_LIMIT),
        attempts: sql`${reviewSync.attempts} + 1`,
      })
      .where(eq(reviewSync.id, id));
  }

  async failuresFor(taskId: TaskId): Promise<ReadonlyMap<string, string>> {
    const rows = await this.context.db
      .select({ subjectId: reviewSync.subjectId, failure: reviewSync.failure })
      .from(reviewSync)
      .where(
        and(
          eq(reviewSync.taskId, taskId.value),
          eq(reviewSync.state, 'failed'),
        ),
      );

    return new Map(
      rows.map((row) => [
        row.subjectId,
        row.failure ?? 'Spotlight couldn’t reach GitHub.',
      ]),
    );
  }

  async forgetTask(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(reviewSync)
      .where(eq(reviewSync.taskId, taskId.value));
  }
}
