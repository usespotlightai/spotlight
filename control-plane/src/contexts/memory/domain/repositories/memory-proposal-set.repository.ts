import type { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const MEMORY_PROPOSAL_SETS = Symbol('MEMORY_PROPOSAL_SETS');

export interface MemoryProposalSetRepository {
  add(set: MemoryProposalSet): Promise<void>;

  save(set: MemoryProposalSet): Promise<void>;

  forTask(taskId: TaskId): Promise<MemoryProposalSet | null>;

  forTaskLocked(taskId: TaskId): Promise<MemoryProposalSet | null>;
}
