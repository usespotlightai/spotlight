export class ReviewCommentMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Review comment ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ReviewCommentMovedOnError';
  }
}
