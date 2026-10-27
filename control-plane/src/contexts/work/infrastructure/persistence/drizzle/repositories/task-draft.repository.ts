import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type {
  StoredDraft,
  TaskDraftStatesPort,
} from '@work/application/ports/task-draft-states.port';
import { TaskDraft } from '@work/domain/aggregates/task-draft.aggregate';
import { DraftAlreadySentError } from '@work/domain/exceptions/draft-already-sent.error';
import type { TaskDraftRepository } from '@work/domain/repositories/task-draft.repository';
import { DraftGeneration } from '@work/domain/value-objects/draft-generation.vo';
import { taskDraft } from '@work/infrastructure/persistence/drizzle/schemas/task-draft.schema';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleTaskDraftRepository
  implements TaskDraftRepository, TaskDraftStatesPort
{
  constructor(private readonly context: DrizzleContext) {}

  async find(taskId: TaskId): Promise<TaskDraft | null> {
    const [row] = await this.context.db
      .select({ generation: taskDraft.generation })
      .from(taskDraft)
      .where(eq(taskDraft.taskId, taskId.value))
      .limit(1);

    return row
      ? TaskDraft.rehydrate({
          taskId,
          generation: DraftGeneration.of(row.generation),
        })
      : null;
  }

  async save(draft: TaskDraft): Promise<void> {
    const saved = await this.context.db
      .insert(taskDraft)
      .values({
        taskId: draft.taskId.value,
        generation: draft.generation.value,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: taskDraft.taskId,
        set: { generation: draft.generation.value, updatedAt: sql`now()` },
        setWhere: eq(taskDraft.generation, draft.storedGeneration.value),
      })
      .returning({ taskId: taskDraft.taskId });

    if (saved.length === 0) {
      throw new DraftAlreadySentError(draft.taskId.value);
    }
  }

  async read(taskId: TaskId): Promise<StoredDraft> {
    const [row] = await this.context.db
      .select({ state: taskDraft.state, generation: taskDraft.generation })
      .from(taskDraft)
      .where(eq(taskDraft.taskId, taskId.value))
      .limit(1);

    return row ?? { state: null, generation: 0 };
  }

  async keep(taskId: TaskId, state: Uint8Array): Promise<void> {
    await this.context.db
      .insert(taskDraft)
      .values({ taskId: taskId.value, state, updatedAt: sql`now()` })
      .onConflictDoUpdate({
        target: taskDraft.taskId,
        set: { state, updatedAt: sql`now()` },
      });
  }
}
