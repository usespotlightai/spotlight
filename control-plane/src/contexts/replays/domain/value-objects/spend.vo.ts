import { InvalidSpendError } from '@replays/domain/exceptions/invalid-spend.error';

export const MAX_CEILING = 1_000;

const countedIn = (currency: string): string => {
  const counted = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(counted)) {
    throw new InvalidSpendError('must be in a three-letter currency');
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
      throw new InvalidSpendError('cannot be negative');
    }

    return new Spend(Math.round(amount * MICROS), countedIn(currency));
  }

  static ceiling(amount: number, currency: string): Spend {
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_CEILING) {
      throw new InvalidSpendError(
        `ceiling must be above 0 and at most ${MAX_CEILING.toLocaleString('en-US')}`,
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
      throw new InvalidSpendError('can only be added in one currency');
    }

    return new Spend(this.micros + other.micros, this.currency);
  }

  scaled(parts: number, of: number): Spend {
    if (
      !Number.isInteger(parts) ||
      !Number.isInteger(of) ||
      parts < 0 ||
      of <= 0
    ) {
      throw new InvalidSpendError('must be split into whole parts');
    }

    return new Spend(Math.floor((this.micros * parts) / of), this.currency);
  }

  scaledCeiling(parts: number, of: number): Spend {
    const scaled = this.scaled(parts, of);

    return scaled.amount > MAX_CEILING
      ? Spend.ceiling(MAX_CEILING, this.currency)
      : scaled;
  }

  isWithin(ceiling: Spend): boolean {
    return this.sameCurrencyAs(ceiling) && this.micros <= ceiling.micros;
  }

  reaches(ceiling: Spend): boolean {
    return this.sameCurrencyAs(ceiling) && this.micros >= ceiling.micros;
  }

  equals(other: Spend): boolean {
    return this.micros === other.micros && this.currency === other.currency;
  }
}
