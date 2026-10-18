export class InvalidTaskNoteError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Task note ${reason}.`);
    this.name = 'InvalidTaskNoteError';
  }
}
