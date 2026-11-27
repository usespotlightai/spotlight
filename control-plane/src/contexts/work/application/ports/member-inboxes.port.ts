export const MEMBER_INBOXES = Symbol('MEMBER_INBOXES');

export interface MemberInboxItem {
  readonly kind: 'task' | 'notice';
  readonly id: string;
  // Null for a notice about the whole workspace.
  readonly teamId: string | null;
  readonly title: string;
  readonly summary: string | null;
  readonly unread: boolean;
  readonly askedAt: Date;
}

export interface MemberInbox {
  readonly personId: string;
  readonly teamsSeen: readonly string[];
  // An owner or admin, who gets the notices about the whole workspace.
  readonly isAdmin: boolean;
  readonly items: readonly MemberInboxItem[];
}

export interface MemberInboxesPort {
  of(workspaceId: string): Promise<readonly MemberInbox[]>;
}
