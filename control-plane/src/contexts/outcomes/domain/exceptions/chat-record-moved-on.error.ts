export class ChatRecordMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(chatId: string) {
    super(
      `This chat's record was written since it was read, and cannot be written over (${chatId})`,
    );
    this.name = 'ChatRecordMovedOnError';
  }
}
