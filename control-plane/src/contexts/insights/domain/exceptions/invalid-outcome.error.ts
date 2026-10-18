export class InvalidOutcomeError extends Error {
  readonly kind = 'invalid' as const;

  constructor(reason: string) {
    super(`Run outcome ${reason}.`);
    this.name = 'InvalidOutcomeError';
  }
}
