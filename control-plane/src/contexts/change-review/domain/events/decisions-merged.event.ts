import type { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DecisionsMerged implements DomainEvent {
  readonly kind = 'decisions.merged';

  constructor(
    readonly setId: DecisionSetId,
    readonly taskId: TaskId,
    readonly commit: string,
  ) {}
}
