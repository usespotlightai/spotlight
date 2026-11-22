import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DeleteMemoryProposalSet {
  constructor(private readonly sets: MemoryProposalSetRepository) {}

  async deleteForTask(taskId: TaskId): Promise<void> {
    const set = await this.sets.forTask(taskId);

    if (set) {
      await this.sets.save(set.delete());
    }
  }
}
