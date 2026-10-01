export const CHAT_STARTED = 'work.chat-started.v1';

export type ChatStartedIntegrationEvent = {
  readonly kind: typeof CHAT_STARTED;
  readonly chatId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly by: string;
  readonly at: string;
};
