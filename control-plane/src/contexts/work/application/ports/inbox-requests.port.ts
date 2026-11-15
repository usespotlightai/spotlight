import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const INBOX_REQUESTS = Symbol('INBOX_REQUESTS');

const INBOX_REQUEST_FORMS = [
  'memories',
  'grade',
  'alert',
  'judge-disagreement',
] as const;

export type InboxRequestFormName = (typeof INBOX_REQUEST_FORMS)[number];

export interface InboxRequestOf {
  readonly taskId: TaskId;
  readonly form: InboxRequestFormName;
  readonly about: string;
}

export interface NewInboxRequest extends InboxRequestOf {
  readonly askedOf?: string | null;
}

export interface InboxRequestsPort {
  create(inboxRequest: NewInboxRequest): Promise<void>;

  reopen(inboxRequest: InboxRequestOf): Promise<void>;

  resolve(inboxRequest: InboxRequestOf): Promise<void>;

  idOf(inboxRequest: InboxRequestOf): Promise<string | null>;
}
