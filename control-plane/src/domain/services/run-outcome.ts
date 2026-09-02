import type { Money } from '@domain/value-objects/money.vo';
import { faulted } from '@domain/value-objects/step-status';

/** What a run's journal says it did, in the terms an outcome is read from. */
export interface Worked {
  readonly ms: number | null;
  readonly statuses: readonly (string | null)[];
  readonly used: number | null;
  readonly size: number | null;
  readonly cost: Money | null;
}

/**
 * What a run came to, once its journal has been read for the last time. Cheap
 * to keep and expensive to work out again, which is why it is kept.
 */
export interface RunOutcome {
  readonly ms: number | null;
  readonly steps: number;
  readonly faults: number;
  readonly used: number | null;
  readonly size: number | null;
  readonly cost: Money | null;
}

/** What a run, or several, came to between them. */
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

/**
 * A task worked three times was paid for three times. Where two runs were
 * counted in different currencies there is nothing true to say about the sum,
 * so it says nothing: adding them would say something false, and refusing to
 * answer would lose the rest of the reading with it.
 */
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
