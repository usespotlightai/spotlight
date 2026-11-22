import type { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import type { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class MemoryMerged implements DomainEvent {
  readonly kind = 'memory.merged';

  constructor(
    readonly memoryId: MemoryId,
    readonly handle: MemoryHandle,
    readonly replaces: readonly MemoryId[],
    readonly decision: MemoryDecision,
  ) {}
}
