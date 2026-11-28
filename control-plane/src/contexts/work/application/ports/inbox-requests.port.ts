import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const INBOX_REQUESTS = Symbol('INBOX_REQUESTS');

const INBOX_REQUEST_FORMS = [
  'memories',
  'alert',
  'judge-disagreement',
] as const;

export type InboxRequestFormName = (typeof INBOX_REQUEST_FORMS)[number];

export interface InboxRequestOf {
  readonly taskId: TaskId;
  readonly form: InboxRequestFormName;
  readonly about: string;
}

export interface AskedInboxRequest extends InboxRequestOf {
  readonly askedOf?: string | null;
  // How many questions it still puts to people; one when left out. Asking
  // again about the same thing updates it while the request is open.
  readonly asks?: number;
}

export interface InboxRequestsPort {
  create(inboxRequest: AskedInboxRequest): Promise<void>;

  reopen(inboxRequest: InboxRequestOf): Promise<void>;

  resolve(inboxRequest: AskedInboxRequest): Promise<void>;

  idOf(inboxRequest: InboxRequestOf): Promise<string | null>;
}
