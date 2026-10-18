export class ChatRecordVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(chatId: string) {
    super(
      `Record of chat ${chatId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ChatRecordVersionConflictError';
  }
}
