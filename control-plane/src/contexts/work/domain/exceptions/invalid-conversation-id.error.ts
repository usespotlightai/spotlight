export class InvalidConversationIdError extends Error {
  readonly violation = 'invalid' as const;

  constructor(value: string) {
    super(`${value} does not name a conversation of a task`);
    this.name = 'InvalidConversationIdError';
  }
}
