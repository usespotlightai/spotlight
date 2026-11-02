export const INBOX_LINKS = Symbol('INBOX_LINKS');

export interface InboxLinksPort {
  conversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<string | null>;

  chat(
    workspaceId: string,
    teamId: string,
    chatId: string,
  ): Promise<string | null>;

  task(
    workspaceId: string,
    teamId: string,
    taskId: string,
  ): Promise<string | null>;
}
