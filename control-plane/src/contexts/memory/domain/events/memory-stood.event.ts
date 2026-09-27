import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class MemoryStood implements DomainEvent {
  readonly kind = 'memory.stood';

  constructor(
    readonly memoryId: MemoryId,
    readonly supersedes: MemoryId | null,
  ) {}
}
