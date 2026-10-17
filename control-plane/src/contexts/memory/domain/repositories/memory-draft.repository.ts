import type { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface MemoryDraftRepository {
  add(draft: MemoryDraft): Promise<void>;

  save(draft: MemoryDraft): Promise<void>;

  forTask(taskId: TaskId): Promise<MemoryDraft | null>;

  nextDueJob(now: Date): Promise<MemoryDraft | null>;

  removeForTask(taskId: TaskId): Promise<void>;
}
