import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PullRequestPurged implements DomainEvent {
  readonly kind = 'pull-request.purged';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: string,
    readonly updatedAt: Date,
  ) {}
}
