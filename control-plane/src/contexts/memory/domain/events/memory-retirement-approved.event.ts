import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class MemoryRetirementApproved implements DomainEvent {
  readonly kind = 'memory-proposal-set.retirement-approved';

  constructor(
    readonly setId: MemoryProposalSetId,
    readonly taskId: TaskId,
    readonly teamId: TeamId,
    readonly proposalId: MemoryId,
    readonly memoryId: MemoryId,
    readonly reason: string,
    readonly decision: MemoryDecision,
  ) {}
}
