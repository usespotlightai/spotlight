import type { RevertTarget } from '@github/domain/services/revert-convention';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PullRequestRevertMerged implements DomainEvent {
  readonly kind = 'pull-request.revert-merged';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: string,
    readonly repository: string,
    readonly reverts: RevertTarget,
    readonly mergedAt: Date | null,
  ) {}
}
