import type { DomainEvent } from '@domain/events/domain-event';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';

/**
 * A run has been given up on: its claimant stopped reporting once too often
 * and there are no attempts left.
 */
export class RunAbandoned implements DomainEvent {
  readonly kind = 'run.abandoned';

  constructor(
    readonly runId: RunId,
    readonly taskId: TaskId | null,
    readonly attempt: number,
  ) {}
}
