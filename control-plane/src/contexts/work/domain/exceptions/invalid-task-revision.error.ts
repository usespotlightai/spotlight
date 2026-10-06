export class InvalidTaskRevisionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(revision: unknown) {
    super(
      `Task revision must be a whole number from 0. Value: ${String(revision)}`,
    );
    this.name = 'InvalidTaskRevisionError';
  }
}
