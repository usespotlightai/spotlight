import type { DomainEvent } from '@domain/events/domain-event';
import type { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import type { TaskId } from '@domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class PullRequestOpened implements DomainEvent {
  readonly kind = 'task.pull-request-opened';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly url: PullRequestUrl,
  ) {}
}
