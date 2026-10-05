import type { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class HostDisconnected implements DomainEvent {
  readonly kind = 'integrations.host-disconnected';

  constructor(
    readonly teamId: TeamId,
    readonly source: SourceKey,
    readonly holder: ConnectionHolder,
  ) {}
}
