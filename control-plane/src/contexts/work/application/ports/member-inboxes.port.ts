export const MEMBER_INBOXES = Symbol('MEMBER_INBOXES');

export interface MemberInboxItem {
  readonly kind: 'task' | 'notice';
  readonly id: string;
  readonly teamId: string;
  readonly title: string;
  readonly summary: string | null;
  readonly unread: boolean;
  readonly askedAt: Date;
}

export interface MemberInbox {
  readonly personId: string;
  readonly teamsSeen: readonly string[];
  readonly items: readonly MemberInboxItem[];
}

export interface MemberInboxesPort {
  of(workspaceId: string): Promise<readonly MemberInbox[]>;
}
