import { InvalidMoneyError } from '@work/domain/exceptions/invalid-money.error';

export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency: string): Money {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new InvalidMoneyError('must be a positive amount');
    }

    const counted = currency.trim();

    if (counted.length === 0) {
      throw new InvalidMoneyError('must name its currency');
    }

    return new Money(amount, counted);
  }

  static maybe(
    amount: number | null | undefined,
    currency: string | null | undefined,
  ): Money | null {
    return amount === null || amount === undefined || !currency
      ? null
      : Money.of(amount, currency);
  }

  plus(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new InvalidMoneyError('cannot be added across currencies');
    }

    return new Money(this.amount + other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
