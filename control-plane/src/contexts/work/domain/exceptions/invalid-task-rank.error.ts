export class InvalidTaskRankError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Task rank ${reason}.`);
    this.name = 'InvalidTaskRankError';
  }
}
