import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { InboxRequest } from '@work/domain/aggregates/inbox-request.aggregate';
import type { InboxRequestForm } from '@work/domain/value-objects/inbox-request-form';
import type { InboxRequestId } from '@work/domain/value-objects/inbox-request-id.vo';
import type { InboxRequestSubject } from '@work/domain/value-objects/inbox-request-subject.vo';

export const INBOX_REQUEST_REPOSITORY = Symbol('INBOX_REQUEST_REPOSITORY');

export interface InboxRequestRepository {
  add(inboxRequest: InboxRequest): Promise<void>;

  save(inboxRequest: InboxRequest): Promise<void>;

  find(id: InboxRequestId): Promise<InboxRequest | null>;

  ofTask(taskId: TaskId): Promise<InboxRequest[]>;

  remove(inboxRequest: InboxRequest): Promise<void>;

  about(
    taskId: TaskId,
    form: InboxRequestForm,
    about: InboxRequestSubject,
  ): Promise<InboxRequest | null>;
}
