import type { RunDigest } from '@work/application/ports/run-digest-reader.port';
import type { Money } from '@work/domain/value-objects/money.vo';

export interface Spent {
  readonly steps: number;
  readonly faults: number;
  readonly cost: Money | null;
}

const addable = (all: Money | null, each: Money | null): Money | null => {
  if (!all || !each) {
    return all ?? each;
  }

  return all.currency === each.currency ? all.plus(each) : null;
};

export const together = (digests: readonly RunDigest[]): Spent =>
  digests.reduce<Spent>(
    (all, each) => ({
      steps: all.steps + each.steps,
      faults: all.faults + each.faults,
      cost: addable(all.cost, each.cost),
    }),
    { steps: 0, faults: 0, cost: null },
  );
