export class RunnerTrustMovedOnError extends Error {
  readonly violation = 'conflict' as const;

  constructor(trustId: string) {
    super(
      `This runner trust has been changed since it was read, and cannot be written over (${trustId})`,
    );
    this.name = 'RunnerTrustMovedOnError';
  }
}
