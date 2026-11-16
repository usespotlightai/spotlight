import type { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class PushDiffLeaseReleased implements DomainEvent {
  readonly kind = 'push-diff.lease-released';

  constructor(readonly diffId: PushDiffId) {}
}
