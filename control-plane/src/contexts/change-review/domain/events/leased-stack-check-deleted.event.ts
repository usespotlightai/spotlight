import type { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class LeasedStackCheckDeleted implements DomainEvent {
  readonly kind = 'stack-check.leased-check-deleted';

  constructor(readonly checkId: StackCheckId) {}
}
