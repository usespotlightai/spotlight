import type { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class MemoryUpkeepSwept implements DomainEvent {
  readonly kind = 'memory-upkeep.swept';

  constructor(
    readonly upkeepId: MemoryUpkeepId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly retiring: number,
    readonly merging: number,
  ) {}
}
