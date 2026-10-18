export class InvalidChatTransitionError extends Error {
  readonly kind = 'conflict' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidChatTransitionError';
  }
}
