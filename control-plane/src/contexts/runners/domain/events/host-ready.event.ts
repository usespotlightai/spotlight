import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class HostReady implements DomainEvent {
  readonly kind = 'runner-host.ready';

  constructor(
    readonly hostId: HostId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
