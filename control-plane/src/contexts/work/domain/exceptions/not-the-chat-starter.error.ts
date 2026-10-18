export class NotTheChatStarterError extends Error {
  readonly kind = 'not-found' as const;

  constructor(chatId: string) {
    super(`Chat ${chatId} not found.`);
    this.name = 'NotTheChatStarterError';
  }
}
