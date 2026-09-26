export class InvalidTaskRevisionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(revision: unknown) {
    super(
      `A task revision is a whole number of moves, not ${String(revision)}`,
    );
    this.name = 'InvalidTaskRevisionError';
  }
}
