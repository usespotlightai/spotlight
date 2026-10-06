export class InvalidConversationIdError extends Error {
  readonly violation = 'invalid' as const;

  constructor(value: string) {
    super(`Conversation id ${value} names no task conversation.`);
    this.name = 'InvalidConversationIdError';
  }
}
