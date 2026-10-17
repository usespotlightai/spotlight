export class ReplaySetVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(setId: string) {
    super(
      `Replay set ${setId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'ReplaySetVersionConflictError';
  }
}
