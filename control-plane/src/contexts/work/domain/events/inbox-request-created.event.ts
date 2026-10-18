import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import type { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';

export class InboxRequestCreated implements DomainEvent {
  readonly kind = 'inbox-request.created';

  constructor(
    readonly inboxRequestId: InboxRequestId,
    readonly taskId: TaskId,
    readonly form: string,
    readonly about: InboxRequestSubject,
  ) {}
}
