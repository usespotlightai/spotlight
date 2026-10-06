export class UnknownChatError extends Error {
  readonly violation = 'not-found' as const;

  constructor(chatId: string) {
    super(`Chat ${chatId} not found.`);
    this.name = 'UnknownChatError';
  }
}
