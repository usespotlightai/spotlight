import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class ForgetMemoryDraft {
  constructor(private readonly drafts: MemoryDraftRepository) {}

  forget(taskId: TaskId): Promise<void> {
    return this.drafts.removeForTask(taskId);
  }
}
