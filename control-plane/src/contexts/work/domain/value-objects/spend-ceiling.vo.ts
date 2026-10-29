import { InvalidSpendCeilingError } from '@work/domain/exceptions/invalid-spend-ceiling.error';

const MAX_SPEND_CEILING = 1_000;

const CURRENCY = /^[A-Z]{3}$/;

export const spendAmountProblem = (
  amount: number,
  most: number | null = MAX_SPEND_CEILING,
): string | null => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return most === null
      ? 'must be above 0'
      : `must be above 0 and at most ${most.toLocaleString('en-US')}`;
  }
  if (most !== null && amount > most) {
    return `must be above 0 and at most ${most.toLocaleString('en-US')}`;
  }

  return null;
};

export class SpendCeiling {
  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  static of(
    amount: number,
    currency: string,
    most: number | null = MAX_SPEND_CEILING,
  ): SpendCeiling {
    const problem = spendAmountProblem(amount, most);
    const counted = currency.trim().toUpperCase();

    if (problem) {
      throw new InvalidSpendCeilingError('amount', problem);
    }
    if (!CURRENCY.test(counted)) {
      throw new InvalidSpendCeilingError(
        'currency',
        'must be a three-letter currency code, as in USD',
      );
    }

    return new SpendCeiling(amount, counted);
  }

  isAbove(other: SpendCeiling): boolean {
    return this.amount > other.amount;
  }

  equals(other: SpendCeiling): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
