import type { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class WorkspaceConnected implements DomainEvent {
  readonly kind = 'workspace.connected';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly installation: GitHubInstallation,
  ) {}
}
