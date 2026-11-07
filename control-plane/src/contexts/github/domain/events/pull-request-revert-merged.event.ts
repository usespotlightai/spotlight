import type { RevertTarget } from '@github/domain/services/revert-convention';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PullRequestRevertMerged implements DomainEvent {
  readonly kind = 'pull-request.revert-merged';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: PullRequestUrl,
    readonly repository: Repository,
    readonly reverts: RevertTarget,
    readonly mergedAt: Date | null,
  ) {}
}
