export class UnknownChatError extends Error {
  readonly kind = 'not-found' as const;

  constructor(chatId: string) {
    super(`Chat ${chatId} not found.`);
    this.name = 'UnknownChatError';
  }
}
