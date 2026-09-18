export class InvalidTaskTitleError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A task title ${reason}`);
    this.name = 'InvalidTaskTitleError';
  }
}
