export class InvalidTaskAsideError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Task aside ${reason}.`);
    this.name = 'InvalidTaskAsideError';
  }
}
