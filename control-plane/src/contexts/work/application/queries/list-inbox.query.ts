import type { PageRequest } from '@shared-kernel/application/dto/page.dto';

export const INBOX_LIST_STATES = ['open', 'resolved'] as const;

export type InboxListState = (typeof INBOX_LIST_STATES)[number];

export class ListInboxQuery {
  constructor(
    readonly slug: string,
    readonly viewerId: string,
    readonly state: InboxListState,
    readonly page: PageRequest,
  ) {}
}

export class ReadInboxItemQuery {
  constructor(
    readonly slug: string,
    readonly itemId: string,
    readonly viewerId: string,
  ) {}
}

export class ReadInboxNoticeQuery {
  constructor(
    readonly slug: string,
    readonly noticeId: string,
    readonly viewerId: string,
  ) {}
}
