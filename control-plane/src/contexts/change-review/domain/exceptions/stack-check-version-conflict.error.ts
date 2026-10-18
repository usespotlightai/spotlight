export class StackCheckVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Change stack check ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'StackCheckVersionConflictError';
  }
}
