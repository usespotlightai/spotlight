export class InvalidChatMessageError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A chat message ${reason}`);
    this.name = 'InvalidChatMessageError';
  }
}
