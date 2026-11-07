import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export type SpendCeilingField = 'amount' | 'currency';

export class InvalidSpendCeilingError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: SpendCeilingField,
    readonly because: string,
  ) {
    super(`Spend ceiling ${field} ${because}.`);
    this.name = 'InvalidSpendCeilingError';
  }
}
