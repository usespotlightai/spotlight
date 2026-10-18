export class ReviewCommentVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Review comment ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ReviewCommentVersionConflictError';
  }
}
