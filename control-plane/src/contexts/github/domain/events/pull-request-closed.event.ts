import type { PullRequestMerge } from '@github/domain/value-objects/pull-request-merge.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PullRequestClosed implements DomainEvent {
  readonly kind = 'pull-request.closed';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: PullRequestUrl,
    readonly repository: Repository,
    readonly gitHubId: number | null,
    readonly merge: PullRequestMerge | null,
    readonly closedAt: Date | null,
  ) {}
}
