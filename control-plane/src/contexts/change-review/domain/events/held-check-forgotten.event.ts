import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class HeldCheckForgotten implements DomainEvent {
  readonly kind = 'change-stack.held-check-forgotten';

  constructor(readonly stackId: ChangeStackId) {}
}
