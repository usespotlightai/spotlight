import type { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class ConnectionRefreshFailed implements DomainEvent {
  readonly kind = 'integrations.connection-refresh-failed';

  constructor(
    readonly teamId: TeamId,
    readonly integration: IntegrationKey,
    readonly owner: ConnectionOwner,
    readonly failedAt: Date,
  ) {}
}
