import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class MemoryRetired implements DomainEvent {
  readonly kind = 'memory.retired';

  constructor(
    readonly memoryId: MemoryId,
    readonly supersededBy: MemoryId | null,
  ) {}
}
