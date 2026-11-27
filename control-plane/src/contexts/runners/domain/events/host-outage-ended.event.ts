import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { HostOutageId } from '@runners/domain/value-objects/host-outage-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class HostOutageEnded implements DomainEvent {
  readonly kind = 'host-outage.ended';

  constructor(
    readonly outageId: HostOutageId,
    readonly workspaceId: WorkspaceId,
    readonly source: CredentialSource,
    readonly at: Date,
  ) {}
}
