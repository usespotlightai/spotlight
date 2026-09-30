export class InvalidOutcomeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A run's outcome ${reason}`);
    this.name = 'InvalidOutcomeError';
  }
}
