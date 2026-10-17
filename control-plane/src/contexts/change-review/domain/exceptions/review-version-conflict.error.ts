export class ReviewVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Review ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ReviewVersionConflictError';
  }
}
