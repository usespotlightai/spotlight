import type { DomainEvent } from '@domain/events/domain-event';
import type { RunnerId } from '@domain/value-objects/runner-id.vo';

export class RunnerRevoked implements DomainEvent {
  readonly kind = 'runner.revoked';

  constructor(readonly runnerId: RunnerId) {}
}
