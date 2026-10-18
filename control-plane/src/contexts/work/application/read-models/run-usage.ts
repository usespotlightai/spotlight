import type { RunUsage } from '@work/application/ports/run-usage-reader.port';
import type { Money } from '@work/domain/value-objects/money.vo';

export interface Spent {
  readonly steps: number;
  readonly errors: number;
  readonly cost: Money | null;
}

const addable = (all: Money | null, each: Money | null): Money | null => {
  if (!all || !each) {
    return all ?? each;
  }

  return all.currency === each.currency ? all.plus(each) : null;
};

export const together = (usages: readonly RunUsage[]): Spent =>
  usages.reduce<Spent>(
    (all, each) => ({
      steps: all.steps + each.steps,
      errors: all.errors + each.errors,
      cost: addable(all.cost, each.cost),
    }),
    { steps: 0, errors: 0, cost: null },
  );
