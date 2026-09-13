import type { DomainEvent } from '@domain/events/domain-event';
import type { SourceKey } from '@domain/value-objects/source-key.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export class HostConnected implements DomainEvent {
  readonly kind = 'host.connected';

  constructor(
    readonly teamId: TeamId,
    readonly source: SourceKey,
  ) {}
}
