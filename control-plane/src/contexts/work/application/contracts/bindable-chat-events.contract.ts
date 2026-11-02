export const BINDABLE_CHAT_EVENTS = [
  'chat.started',
  'chat.replied',
  'chat.refused',
  'chat.acknowledged',
] as const;

export type BindableChatEvent = (typeof BINDABLE_CHAT_EVENTS)[number];
