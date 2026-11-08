import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';

export class InboxRequestOpened implements DomainEvent {
  readonly kind = 'inbox-request.opened';

  constructor(
    readonly inboxRequestId: InboxRequestId,
    readonly workspaceId: WorkspaceId,
    readonly taskId: TaskId,
    readonly at: Date,
  ) {}
}
