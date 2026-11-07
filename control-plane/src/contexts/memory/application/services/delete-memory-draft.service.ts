import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DeleteMemoryDraft {
  constructor(private readonly drafts: MemoryDraftRepository) {}

  async deleteForTask(taskId: TaskId): Promise<void> {
    const draft = await this.drafts.forTask(taskId);

    if (draft) {
      await this.drafts.remove(draft);
    }
  }
}
