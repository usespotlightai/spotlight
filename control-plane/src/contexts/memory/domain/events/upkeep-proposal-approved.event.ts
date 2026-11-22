import type { MemoryBody } from '@memory/domain/value-objects/memory-body';
import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import type { UpkeepChange } from '@memory/domain/value-objects/upkeep-change';
import type { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class UpkeepProposalApproved implements DomainEvent {
  readonly kind = 'memory-upkeep.approved';

  constructor(
    readonly upkeepId: MemoryUpkeepId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly proposalId: UpkeepProposalId,
    readonly change: UpkeepChange,
    readonly memories: readonly MemoryId[],
    readonly body: MemoryBody | null,
    readonly reason: string,
    readonly decision: MemoryDecision,
    readonly merged: MemoryId | null,
  ) {}
}
