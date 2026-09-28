export class ReviewCommentMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `This review comment changed since it was read, and cannot be written over (${id})`,
    );
    this.name = 'ReviewCommentMovedOnError';
  }
}
