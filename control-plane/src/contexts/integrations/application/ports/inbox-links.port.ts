export const INBOX_LINKS = Symbol('INBOX_LINKS');

export interface InboxLinksPort {
  conversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<string | null>;
}
