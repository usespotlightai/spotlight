import type { DomainEvent } from '@domain/events/domain-event';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';

/** A runner's token has been retired, so it can no longer serve the work it holds. */
export class RunnerRevoked implements DomainEvent {
  readonly kind = 'runner.revoked';

  constructor(readonly runnerId: RunnerId) {}
}
