import { InvalidMoneyError } from '@replays/domain/exceptions/invalid-money.error';

export const MAX_CEILING = 1_000;

const countedIn = (currency: string): string => {
  const counted = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(counted)) {
    throw new InvalidMoneyError('must be in a three-letter currency');
  }

  return counted;
};

const MICROS = 1_000_000;

export class Money {
  private constructor(
    private readonly micros: number,
    readonly currency: string,
  ) {}

  get amount(): number {
    return this.micros / MICROS;
  }

  static of(amount: number, currency: string): Money {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new InvalidMoneyError('cannot be negative');
    }

    return new Money(Math.round(amount * MICROS), countedIn(currency));
  }

  static ceiling(amount: number, currency: string): Money {
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_CEILING) {
      throw new InvalidMoneyError(
        `ceiling must be above 0 and at most ${MAX_CEILING.toLocaleString('en-US')}`,
      );
    }

    return Money.of(amount, currency);
  }

  static none(currency: string): Money {
    return Money.of(0, currency);
  }

  sameCurrencyAs(other: Money): boolean {
    return this.currency === other.currency;
  }

  plus(other: Money): Money {
    if (!this.sameCurrencyAs(other)) {
      throw new InvalidMoneyError('can only be added in one currency');
    }

    return new Money(this.micros + other.micros, this.currency);
  }

  scaled(parts: number, of: number): Money {
    if (
      !Number.isInteger(parts) ||
      !Number.isInteger(of) ||
      parts < 0 ||
      of <= 0
    ) {
      throw new InvalidMoneyError('must be split into whole parts');
    }

    return new Money(Math.floor((this.micros * parts) / of), this.currency);
  }

  scaledCeiling(parts: number, of: number): Money {
    const scaled = this.scaled(parts, of);

    return scaled.amount > MAX_CEILING
      ? Money.ceiling(MAX_CEILING, this.currency)
      : scaled;
  }

  isWithin(ceiling: Money): boolean {
    return this.sameCurrencyAs(ceiling) && this.micros <= ceiling.micros;
  }

  meets(ceiling: Money): boolean {
    return this.sameCurrencyAs(ceiling) && this.micros >= ceiling.micros;
  }

  equals(other: Money): boolean {
    return this.micros === other.micros && this.currency === other.currency;
  }
}
