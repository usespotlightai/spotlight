import type { Money } from '@domain/value-objects/money.vo';
import { faulted } from '@domain/value-objects/step-status';

export interface Worked {
  readonly ms: number | null;
  readonly statuses: readonly (string | null)[];
  readonly used: number | null;
  readonly size: number | null;
  readonly cost: Money | null;
}

export interface RunOutcome {
  readonly ms: number | null;
  readonly steps: number;
  readonly faults: number;
  readonly used: number | null;
  readonly size: number | null;
  readonly cost: Money | null;
}

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

export const together = (outcomes: readonly RunOutcome[]): Spent =>
  outcomes.reduce<Spent>(
    (all, each) => ({
      steps: all.steps + each.steps,
      faults: all.faults + each.faults,
      cost: addable(all.cost, each.cost),
    }),
    { steps: 0, faults: 0, cost: null },
  );

export const outcomeOf = (worked: Worked): RunOutcome => ({
  ms: worked.ms,
  steps: worked.statuses.length,
  faults: worked.statuses.filter(faulted).length,
  used: worked.used,
  size: worked.size,
  cost: worked.cost,
});
