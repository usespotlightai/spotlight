import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerHostStartedServing implements DomainEvent {
  readonly kind = 'runner-host.started-serving';

  constructor(
    readonly hostId: HostId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
