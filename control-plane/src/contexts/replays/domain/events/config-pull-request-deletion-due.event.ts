import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ConfigPullRequestDeletionDue implements DomainEvent {
  readonly kind = 'replays.config-pull-request-deletion-due';

  constructor(
    readonly pullRequestId: ConfigPullRequestId,
    readonly workspaceId: WorkspaceId,
  ) {}
}
