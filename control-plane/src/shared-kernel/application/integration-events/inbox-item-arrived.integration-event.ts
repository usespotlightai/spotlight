export const INBOX_ITEM_ARRIVED = 'work.inbox-item-arrived.v1';

export type InboxItemArrivedIntegrationEvent = {
  readonly kind: typeof INBOX_ITEM_ARRIVED;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly personId: string;
  readonly itemId: string;
  readonly itemKind: 'task' | 'notice';
  readonly title: string;
  readonly summary: string | null;
  readonly askedAt: string;
};
