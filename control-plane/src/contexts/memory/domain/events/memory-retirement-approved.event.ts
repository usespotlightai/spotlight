import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryDraftId } from '@memory/domain/value-objects/memory-draft-id.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class MemoryRetirementApproved implements DomainEvent {
  readonly kind = 'memory-draft.retirement-approved';

  constructor(
    readonly draftId: MemoryDraftId,
    readonly taskId: TaskId,
    readonly teamId: TeamId,
    readonly proposalId: MemoryId,
    readonly memoryId: MemoryId,
    readonly reason: string,
    readonly decision: MemoryDecision,
  ) {}
}
