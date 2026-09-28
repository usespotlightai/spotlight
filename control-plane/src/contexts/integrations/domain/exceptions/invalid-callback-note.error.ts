export class InvalidCallbackNoteError extends Error {
  readonly violation = 'invalid' as const;

  constructor(longest: number) {
    super(`A note says something, in at most ${longest} characters`);
    this.name = 'InvalidCallbackNoteError';
  }
}
