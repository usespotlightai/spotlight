import type { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class StackCheckLayersFailed implements DomainEvent {
  readonly kind = 'stack-check.layers-failed';

  constructor(
    readonly checkId: StackCheckId,
    readonly runId: RunId,
  ) {}
}
