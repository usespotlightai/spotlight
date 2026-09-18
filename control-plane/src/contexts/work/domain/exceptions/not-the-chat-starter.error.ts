export class NotTheChatStarterError extends Error {
  readonly violation = 'not-found' as const;

  constructor(chatId: string) {
    super(`There is no chat ${chatId}`);
    this.name = 'NotTheChatStarterError';
  }
}
