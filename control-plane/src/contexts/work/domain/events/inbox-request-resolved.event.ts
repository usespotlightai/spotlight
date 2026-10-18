import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';

export class InboxRequestResolved implements DomainEvent {
  readonly kind = 'inbox-request.resolved';

  constructor(
    readonly inboxRequestId: InboxRequestId,
    readonly taskId: TaskId,
  ) {}
}
