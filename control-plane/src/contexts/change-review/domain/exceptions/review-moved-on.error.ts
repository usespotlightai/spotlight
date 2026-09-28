export class ReviewMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This review changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'ReviewMovedOnError';
  }
}
