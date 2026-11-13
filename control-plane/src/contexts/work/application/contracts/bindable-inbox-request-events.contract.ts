export const BINDABLE_INBOX_REQUEST_EVENTS = ['inbox-request.opened'] as const;

export type BindableInboxRequestEvent =
  (typeof BINDABLE_INBOX_REQUEST_EVENTS)[number];
