export class ChatMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(chatId: string) {
    super(`The chat ${chatId} changed while this was being written`);
    this.name = 'ChatMovedOnError';
  }
}
