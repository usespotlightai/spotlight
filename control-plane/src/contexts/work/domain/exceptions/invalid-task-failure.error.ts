export class InvalidTaskFailureError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Task failure ${reason}.`);
    this.name = 'InvalidTaskFailureError';
  }
}
