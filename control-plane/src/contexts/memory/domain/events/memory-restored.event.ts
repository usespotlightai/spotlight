import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class MemoryRestored implements DomainEvent {
  readonly kind = 'memory.restored';

  constructor(
    readonly memoryId: MemoryId,
    readonly teamId: TeamId,
    readonly by: UserId,
    readonly at: Date,
  ) {}
}
