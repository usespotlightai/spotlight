import type { DomainEvent } from '@domain/events/domain-event';
import type { RunId } from '@domain/value-objects/run-id.vo';
import type { RunSubject } from '@domain/value-objects/run-subject.vo';

export class RunStopRequested implements DomainEvent {
  readonly kind = 'run.stop_requested';

  constructor(
    readonly runId: RunId,
    readonly subject: RunSubject | null,
    readonly at: Date,
  ) {}
}
