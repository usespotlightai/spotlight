export class InvalidTaskTransitionError extends Error {
  readonly violation = 'conflict' as const;

  constructor(reason: string) {
    super(reason);
    this.name = 'InvalidTaskTransitionError';
  }
}
