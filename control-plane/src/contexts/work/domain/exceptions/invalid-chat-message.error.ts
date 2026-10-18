export class InvalidChatMessageError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Chat message ${reason}.`);
    this.name = 'InvalidChatMessageError';
  }
}
