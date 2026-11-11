export const INBOX_LINKS = Symbol('INBOX_LINKS');

export interface InboxLinksPort {
  pathTo(
    workspaceSlug: string,
    itemKind: 'task' | 'notice',
    itemId: string,
  ): string;
}
