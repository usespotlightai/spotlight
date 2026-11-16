import type { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export class PushDiffRecorded implements DomainEvent {
  readonly kind = 'push-diff.recorded';

  constructor(readonly diffId: PushDiffId) {}
}
