import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ChangeStackFailed implements DomainEvent {
  readonly kind = 'change-stack.failed';

  constructor(
    readonly stackId: ChangeStackId,
    readonly runId: RunId,
    readonly failure: string,
  ) {}
}
