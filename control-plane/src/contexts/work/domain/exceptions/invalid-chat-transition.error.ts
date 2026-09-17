export class InvalidChatTransitionError extends Error {
  readonly violation = 'conflict' as const;

  constructor(reason: string) {
    super(`The chat ${reason}`);
    this.name = 'InvalidChatTransitionError';
  }
}
