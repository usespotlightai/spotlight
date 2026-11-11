import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type {
  StoredDraft,
  TaskDraftStatesPort,
} from '@work/application/ports/task-draft-states.port';
import { task } from '@work/infrastructure/persistence/drizzle/schemas/task.schema';
import { taskDraftState } from '@work/infrastructure/persistence/drizzle/schemas/task-draft.schema';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleTaskDraftStates implements TaskDraftStatesPort {
  constructor(private readonly context: DrizzleContext) {}

  async read(taskId: TaskId): Promise<StoredDraft> {
    const [[kept], [sent]] = await Promise.all([
      this.context.db
        .select({ state: taskDraftState.state })
        .from(taskDraftState)
        .where(eq(taskDraftState.taskId, taskId.value))
        .limit(1),
      this.context.db
        .select({ generation: task.draftGeneration })
        .from(task)
        .where(eq(task.id, taskId.value))
        .limit(1),
    ]);

    return { state: kept?.state ?? null, generation: sent?.generation ?? 0 };
  }

  async keep(taskId: TaskId, state: Uint8Array): Promise<void> {
    await this.context.db
      .insert(taskDraftState)
      .values({ taskId: taskId.value, state, updatedAt: sql`now()` })
      .onConflictDoUpdate({
        target: taskDraftState.taskId,
        set: { state, updatedAt: sql`now()` },
      });
  }

  async forget(taskId: TaskId): Promise<void> {
    await this.context.db
      .delete(taskDraftState)
      .where(eq(taskDraftState.taskId, taskId.value));
  }
}
