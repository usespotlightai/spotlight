export class RunVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(id: string) {
    super(
      `Run ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'RunVersionConflictError';
  }
}
