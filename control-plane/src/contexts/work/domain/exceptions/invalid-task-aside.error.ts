export class InvalidTaskAsideError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A task aside ${reason}`);
    this.name = 'InvalidTaskAsideError';
  }
}
