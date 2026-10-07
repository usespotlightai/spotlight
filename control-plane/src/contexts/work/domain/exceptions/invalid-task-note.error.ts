export class InvalidTaskNoteError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Task note ${reason}.`);
    this.name = 'InvalidTaskNoteError';
  }
}
