import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PullRequestReleased implements DomainEvent {
  readonly kind = 'pull-request-record.released';

  constructor(
    readonly workspaceId: WorkspaceId,
    readonly pullRequest: PullRequestUrl,
    readonly taskIds: readonly TaskId[],
  ) {}
}
