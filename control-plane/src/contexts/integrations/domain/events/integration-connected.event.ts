import type { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class IntegrationConnected implements DomainEvent {
  readonly kind = 'integrations.integration-connected';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly integration: IntegrationKey,
    readonly owner: ConnectionOwner,
    readonly linkedAccount: string | null,
  ) {}

  get changesSpecFetch(): boolean {
    return !this.owner.isPerson;
  }
}
