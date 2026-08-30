export class InvalidTaskNoteError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A task note ${reason}`);
    this.name = 'InvalidTaskNoteError';
  }
}
