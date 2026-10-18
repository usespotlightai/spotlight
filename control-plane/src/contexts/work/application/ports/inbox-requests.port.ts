import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const INBOX_REQUESTS = Symbol('INBOX_REQUESTS');

export interface InboxRequestOf {
  readonly taskId: TaskId;
  readonly form: string;
  readonly about: string;
}

export interface InboxRequestsPort {
  create(inboxRequest: InboxRequestOf): Promise<void>;

  reopen(inboxRequest: InboxRequestOf): Promise<void>;

  resolve(inboxRequest: InboxRequestOf): Promise<void>;

  idOf(inboxRequest: InboxRequestOf): Promise<string | null>;
}
