import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PullRequestReopened implements DomainEvent {
  readonly kind = 'pull-request.reopened';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: PullRequestUrl,
    readonly repository: Repository,
    readonly gitHubId: number | null,
    readonly reopenedAt: Date | null,
  ) {}
}
