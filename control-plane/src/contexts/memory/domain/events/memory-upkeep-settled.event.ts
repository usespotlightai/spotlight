import type { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class MemoryUpkeepSettled implements DomainEvent {
  readonly kind = 'memory-upkeep.settled';

  constructor(
    readonly upkeepId: MemoryUpkeepId,
    readonly teamId: TeamId,
  ) {}
}
