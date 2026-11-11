import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { StoredModelSpent } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';

export const modelSpentOf = (stored: StoredModelSpent): ModelSpent =>
  ModelSpent.of(
    stored.spends.map((each) => Money.of(each.amount, each.currency)),
    stored.unpriced,
  );

export const storedSpent = (spent: ModelSpent): StoredModelSpent => ({
  spends: spent.spends.map((each) => ({
    amount: each.amount,
    currency: each.currency,
  })),
  unpriced: spent.unpriced,
});

export const optionalModelSpentOf = (
  stored: StoredModelSpent | null,
): ModelSpent | null => stored && modelSpentOf(stored);

export const optionalStoredSpent = (
  spent: ModelSpent | null,
): StoredModelSpent | null => spent && storedSpent(spent);
