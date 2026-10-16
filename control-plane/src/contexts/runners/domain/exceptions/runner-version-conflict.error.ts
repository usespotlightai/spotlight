export class RunnerVersionConflictError extends Error {
  readonly violation = 'conflict' as const;

  constructor(runnerId: string) {
    super(
      `Runner ${runnerId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'RunnerVersionConflictError';
  }
}
