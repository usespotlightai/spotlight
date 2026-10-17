export class StartingPointHoldVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(holder: string) {
    super(
      `Starting point hold for ${holder} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'StartingPointHoldVersionConflictError';
  }
}
