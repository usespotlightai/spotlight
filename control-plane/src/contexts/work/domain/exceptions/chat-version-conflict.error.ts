export class ChatVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(chatId: string) {
    super(
      `Chat ${chatId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ChatVersionConflictError';
  }
}
