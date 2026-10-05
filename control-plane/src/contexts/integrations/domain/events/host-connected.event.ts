import type { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class HostConnected implements DomainEvent {
  readonly kind = 'integrations.host-connected';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly source: SourceKey,
    readonly holder: ConnectionHolder,
    readonly handle: string | null,
  ) {}

  get changesWhatDescriptionsAreReadWith(): boolean {
    return !this.holder.isPerson;
  }
}
