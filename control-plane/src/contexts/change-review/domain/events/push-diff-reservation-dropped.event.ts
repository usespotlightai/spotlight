import type { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class PushDiffReservationDropped implements DomainEvent {
  readonly kind = 'push-diff.reservation-dropped';

  constructor(
    readonly diffId: PushDiffId,
    readonly runner: RunnerId,
  ) {}
}
