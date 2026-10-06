export class InvalidTaskTitleError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Task title ${reason}.`);
    this.name = 'InvalidTaskTitleError';
  }
}
