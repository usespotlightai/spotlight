import { InvalidSpendError } from '@replays/domain/exceptions/invalid-spend.error';

const MOST_CEILING = 1_000;

const countedIn = (currency: string): string => {
  const counted = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(counted)) {
    throw new InvalidSpendError('is counted in a three-letter currency');
  }

  return counted;
};

const MICROS = 1_000_000;

export class Spend {
  private constructor(
    private readonly micros: number,
    readonly currency: string,
  ) {}

  get amount(): number {
    return this.micros / MICROS;
  }

  static of(amount: number, currency: string): Spend {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new InvalidSpendError('is no less than nothing');
    }

    return new Spend(Math.round(amount * MICROS), countedIn(currency));
  }

  static ceiling(amount: number, currency: string): Spend {
    if (!Number.isFinite(amount) || amount <= 0 || amount > MOST_CEILING) {
      throw new InvalidSpendError(
        `is capped at more than nothing and at most ${MOST_CEILING.toLocaleString('en-US')}`,
      );
    }

    return Spend.of(amount, currency);
  }

  static none(currency: string): Spend {
    return Spend.of(0, currency);
  }

  sameCurrencyAs(other: Spend): boolean {
    return this.currency === other.currency;
  }

  plus(other: Spend): Spend {
    if (!this.sameCurrencyAs(other)) {
      throw new InvalidSpendError('is added up only in one currency');
    }

    return new Spend(this.micros + other.micros, this.currency);
  }

  reaches(ceiling: Spend): boolean {
    return this.sameCurrencyAs(ceiling) && this.micros >= ceiling.micros;
  }

  equals(other: Spend): boolean {
    return this.micros === other.micros && this.currency === other.currency;
  }
}
