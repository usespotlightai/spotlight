import type { DomainEvent } from '@domain/events/domain-event';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';

export class RunStopRequested implements DomainEvent {
  readonly kind = 'run.stop_requested';

  constructor(
    readonly runId: RunId,
    readonly taskId: TaskId | null,
    readonly at: Date,
  ) {}
}
