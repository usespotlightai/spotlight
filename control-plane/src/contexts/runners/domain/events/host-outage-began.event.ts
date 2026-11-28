import type { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import type { HostOutageId } from '@runners/domain/value-objects/host-outage-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class HostOutageBegan implements DomainEvent {
  readonly kind = 'host-outage.began';

  constructor(
    readonly outageId: HostOutageId,
    readonly workspaceId: WorkspaceId,
    readonly source: CredentialSource,
    // The key of the pool or trust, or null once it is gone.
    readonly sourceKey: string | null,
    // The names of its hosts, none of which reports in.
    readonly hosts: readonly string[],
    readonly since: Date,
    readonly at: Date,
  ) {}
}
