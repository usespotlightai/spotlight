export class InvalidTaskFailureError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A task failure ${reason}`);
    this.name = 'InvalidTaskFailureError';
  }
}
