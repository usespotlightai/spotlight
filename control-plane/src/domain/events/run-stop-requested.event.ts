import type { DomainEvent } from '@domain/events/domain-event';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';

/**
 * A person has asked a run to stop, while it is still being worked. Recorded so
 * the request is a fact of the model, not just a column a poller reads.
 */
export class RunStopRequested implements DomainEvent {
  readonly kind = 'run.stop_requested';

  constructor(
    readonly runId: RunId,
    readonly taskId: TaskId | null,
    readonly at: Date,
  ) {}
}
