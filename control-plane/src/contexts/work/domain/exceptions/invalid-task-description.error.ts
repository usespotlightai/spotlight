export class InvalidTaskDescriptionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Task description ${reason}.`);
    this.name = 'InvalidTaskDescriptionError';
  }
}
