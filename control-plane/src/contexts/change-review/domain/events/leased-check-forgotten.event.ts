import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class LeasedCheckForgotten implements DomainEvent {
  readonly kind = 'change-stack.leased-check-forgotten';

  constructor(readonly stackId: ChangeStackId) {}
}
