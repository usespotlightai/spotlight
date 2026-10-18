import { InvalidMoneyError } from '@replays/domain/exceptions/invalid-money.error';
import type { Money } from '@replays/domain/value-objects/money.vo';

const summed = (spends: readonly Money[]): readonly Money[] => {
  const byCurrency = new Map<string, Money>();

  for (const each of spends) {
    const sum = byCurrency.get(each.currency);
    byCurrency.set(each.currency, sum ? sum.plus(each) : each);
  }

  return [...byCurrency.values()];
};

export class ModelSpent {
  private constructor(
    readonly spends: readonly Money[],
    readonly unpriced: number,
  ) {}

  static of(spends: readonly Money[], unpriced: number): ModelSpent {
    if (!Number.isInteger(unpriced) || unpriced < 0) {
      throw new InvalidMoneyError('unpriced calls must be a whole number');
    }

    return new ModelSpent(summed(spends), unpriced);
  }

  plus(other: ModelSpent): ModelSpent {
    return ModelSpent.of(
      [...this.spends, ...other.spends],
      this.unpriced + other.unpriced,
    );
  }

  equals(other: ModelSpent): boolean {
    return (
      this.unpriced === other.unpriced &&
      this.spends.length === other.spends.length &&
      this.spends.every((each) =>
        other.spends.some((theirs) => theirs.equals(each)),
      )
    );
  }
}
