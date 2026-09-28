import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class CheckReservationDropped implements DomainEvent {
  readonly kind = 'change-stack.check-reservation-dropped';

  constructor(
    readonly stackId: ChangeStackId,
    readonly runner: RunnerId,
  ) {}
}
