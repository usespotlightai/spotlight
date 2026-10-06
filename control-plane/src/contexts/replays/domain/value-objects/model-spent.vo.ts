import { InvalidSpendError } from '@replays/domain/exceptions/invalid-spend.error';
import type { Spend } from '@replays/domain/value-objects/spend.vo';

const summed = (spends: readonly Spend[]): readonly Spend[] => {
  const byCurrency = new Map<string, Spend>();

  for (const each of spends) {
    const held = byCurrency.get(each.currency);
    byCurrency.set(each.currency, held ? held.plus(each) : each);
  }

  return [...byCurrency.values()];
};

export class ModelSpent {
  private constructor(
    readonly spends: readonly Spend[],
    readonly unpriced: number,
  ) {}

  static of(spends: readonly Spend[], unpriced: number): ModelSpent {
    if (!Number.isInteger(unpriced) || unpriced < 0) {
      throw new InvalidSpendError('unpriced calls must be a whole number');
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
