import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PullRequestMerge {
  readonly commit: string;
}

export class PullRequestClosed implements DomainEvent {
  readonly kind = 'pull-request.closed';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: string,
    readonly repository: string,
    readonly gitHubId: number | null,
    readonly merge: PullRequestMerge | null,
    readonly closedAt: Date | null,
  ) {}
}
