export class InvalidTaskDescriptionError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Task description ${reason}.`);
    this.name = 'InvalidTaskDescriptionError';
  }
}
