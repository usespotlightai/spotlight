export class InvalidChatMessageError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Chat message ${reason}.`);
    this.name = 'InvalidChatMessageError';
  }
}
