import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class HostConnected implements DomainEvent {
  readonly kind = 'integrations.host-connected';

  constructor(
    readonly teamId: TeamId,
    readonly source: SourceKey,
  ) {}
}
