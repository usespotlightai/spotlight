import type { HostId } from '@runners/domain/value-objects/host-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { SandboxId } from '@shared-kernel/domain/value-objects/sandbox-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class HostStoppedReportingSandbox implements DomainEvent {
  readonly kind = 'runner-host.stopped-reporting-sandbox';

  constructor(
    readonly hostId: HostId,
    readonly workspaceId: WorkspaceId,
    readonly sandboxId: SandboxId,
    readonly at: Date,
  ) {}
}
