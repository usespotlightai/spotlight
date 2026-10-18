export class InvalidTaskTitleError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Task title ${reason}.`);
    this.name = 'InvalidTaskTitleError';
  }
}
