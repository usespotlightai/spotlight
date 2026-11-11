export const INBOX_REQUEST_OPENED = 'work.inbox-request-opened.v1';

export type InboxRequestOpenedIntegrationEvent = {
  readonly kind: typeof INBOX_REQUEST_OPENED;
  readonly inboxRequestId: string;
  readonly workspaceId: string;
  readonly taskId: string;
  readonly at: string;
};
