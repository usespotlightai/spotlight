export class RunnerTrustVersionConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(trustId: string) {
    super(
      `Runner trust ${trustId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'RunnerTrustVersionConflictError';
  }
}
