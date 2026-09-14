import type { DomainEvent } from '@domain/events/domain-event';
import type { Declaration } from '@domain/value-objects/declaration.vo';
import type { HarnessSession } from '@domain/value-objects/harness-session.vo';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunOutcome } from '@domain/value-objects/run-outcome.vo';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';

export class RunCompleted implements DomainEvent {
  readonly kind = 'run.completed';

  constructor(
    readonly runId: RunId,
    readonly taskId: TaskId | null,
    readonly result: RunOutcome,
    readonly workedBy: RunnerId | null,
    readonly declared: Declaration | null,
    readonly session: HarnessSession | null,
  ) {}
}
