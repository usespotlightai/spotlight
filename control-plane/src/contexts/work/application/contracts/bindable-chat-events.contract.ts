const CHAT_NOTICE_KINDS = [
  'chat.replied',
  'chat.refused',
  'chat.acknowledged',
] as const;

export type ChatNoticeKind = (typeof CHAT_NOTICE_KINDS)[number];

export const BINDABLE_CHAT_EVENTS = [
  'chat.started',
  'chat.dispatched',
  ...CHAT_NOTICE_KINDS,
] as const;

export type BindableChatEvent = (typeof BINDABLE_CHAT_EVENTS)[number];
