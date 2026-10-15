export class InvalidConversationIdError extends Error {
  readonly violation = 'invalid' as const;

  constructor(value: string) {
    super(`Conversation id ${value} does not name a task conversation.`);
    this.name = 'InvalidConversationIdError';
  }
}
