export class RunnerHostVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(hostId: string) {
    super(
      `Host ${hostId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'RunnerHostVersionConflictError';
  }
}
