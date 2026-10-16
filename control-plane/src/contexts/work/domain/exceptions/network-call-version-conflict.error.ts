export class NetworkCallVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(id: string) {
    super(
      `Network call ${id} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'NetworkCallVersionConflictError';
  }
}
