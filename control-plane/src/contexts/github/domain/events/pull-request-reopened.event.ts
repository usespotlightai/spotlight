import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PullRequestReopened implements DomainEvent {
  readonly kind = 'pull-request.reopened';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: string,
    readonly repository: string,
    readonly gitHubId: number | null,
    readonly reopenedAt: Date | null,
  ) {}
}
