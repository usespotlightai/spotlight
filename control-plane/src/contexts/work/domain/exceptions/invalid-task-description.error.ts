export class InvalidTaskDescriptionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A task description ${reason}`);
    this.name = 'InvalidTaskDescriptionError';
  }
}
