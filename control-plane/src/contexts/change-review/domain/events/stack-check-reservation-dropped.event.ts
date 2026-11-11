import type { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class StackCheckReservationDropped implements DomainEvent {
  readonly kind = 'stack-check.reservation-dropped';

  constructor(
    readonly checkId: StackCheckId,
    readonly runner: RunnerId,
  ) {}
}
