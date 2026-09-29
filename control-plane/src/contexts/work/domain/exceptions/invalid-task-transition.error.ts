export class InvalidTaskTransitionError extends Error {
  readonly violation = 'conflict' as const;

  constructor(reason: string) {
    super(`The task ${reason}`);
    this.name = 'InvalidTaskTransitionError';
  }
}
