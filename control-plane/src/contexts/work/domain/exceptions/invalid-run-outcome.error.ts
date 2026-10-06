export class InvalidRunOutcomeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Run outcome ${reason}.`);
    this.name = 'InvalidRunOutcomeError';
  }
}
