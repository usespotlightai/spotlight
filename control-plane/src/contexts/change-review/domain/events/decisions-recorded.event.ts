import type { DecisionSetId } from '@change-review/domain/value-objects/decision-set-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export class DecisionsRecorded implements DomainEvent {
  readonly kind = 'decisions.recorded';

  constructor(
    readonly setId: DecisionSetId,
    readonly taskId: TaskId,
    readonly runId: RunId,
    readonly recorded: number,
    readonly dropped: number,
  ) {}
}
