import type { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { Erased } from '@shared-kernel/domain/erased';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const MEMORY_DRAFTS = Symbol('MEMORY_DRAFTS');

export interface MemoryDraftRepository {
  add(draft: MemoryDraft): Promise<void>;

  save(draft: MemoryDraft): Promise<void>;

  remove(draft: Erased<MemoryDraft>): Promise<void>;

  forTask(taskId: TaskId): Promise<MemoryDraft | null>;

  nextDueJob(now: Date): Promise<MemoryDraft | null>;
}
