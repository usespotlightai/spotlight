export class InvalidRunOutcomeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`A run outcome ${reason}`);
    this.name = 'InvalidRunOutcomeError';
  }
}
