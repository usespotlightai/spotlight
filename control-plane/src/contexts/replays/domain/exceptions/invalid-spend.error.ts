export class InvalidSpendError extends Error {
  readonly violation = 'invalid' as const;

  constructor(reason: string) {
    super(`Spend ${reason}.`);
    this.name = 'InvalidSpendError';
  }
}
