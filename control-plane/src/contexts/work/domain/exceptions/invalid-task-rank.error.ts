export class InvalidTaskRankError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A task rank ${reason}`);
    this.name = 'InvalidTaskRankError';
  }
}
