import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class LeasedCheckDeleted implements DomainEvent {
  readonly kind = 'change-stack.leased-check-deleted';

  constructor(readonly stackId: ChangeStackId) {}
}
