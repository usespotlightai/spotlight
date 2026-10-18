import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DeleteMemoryDraft {
  constructor(private readonly drafts: MemoryDraftRepository) {}

  deleteForTask(taskId: TaskId): Promise<void> {
    return this.drafts.removeForTask(taskId);
  }
}
