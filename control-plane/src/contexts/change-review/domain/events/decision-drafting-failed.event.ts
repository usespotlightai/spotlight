import type { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DecisionDraftingFailed implements DomainEvent {
  readonly kind = 'decisions.drafting-failed';

  constructor(
    readonly setId: DecisionSetId,
    readonly taskId: TaskId,
    readonly runId: RunId,
  ) {}
}
