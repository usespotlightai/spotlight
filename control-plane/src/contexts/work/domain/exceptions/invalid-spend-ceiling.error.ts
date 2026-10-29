export type SpendCeilingField = 'amount' | 'currency';

export class InvalidSpendCeilingError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: SpendCeilingField,
    readonly because: string,
  ) {
    super(`Spend ceiling ${field} ${because}.`);
    this.name = 'InvalidSpendCeilingError';
  }
}
