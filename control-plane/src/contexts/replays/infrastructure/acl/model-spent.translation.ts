import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { ModelUsage } from '@shared-kernel/domain/value-objects/model-usage.vo';

export const modelSpentOf = (usage: ModelUsage): ModelSpent =>
  ModelSpent.of(
    usage.costs.map((each) => Money.of(each.amount, each.currency)),
    usage.unpriced,
  );
