export const BINDABLE_NOTICE_EVENTS = ['notice.raised'] as const;

export type BindableNoticeEvent = (typeof BINDABLE_NOTICE_EVENTS)[number];
