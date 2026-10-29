import { InvalidMoneyError } from '@replays/domain/exceptions/invalid-money.error';
import { InvalidSearchError } from '@replays/domain/exceptions/invalid-search.error';
import { aBudget } from '@replays/domain/replays.fake-spec';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import {
  MAX_CONCURRENCY,
  MAX_ITERATIONS,
  MAX_PER_ITERATION,
  SEARCH_CONCURRENCY,
  SearchBudget,
} from '@replays/domain/value-objects/search-budget.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const splitOf = (runs: number): HeldOutSplit => {
  const heldOutCount = Math.ceil(0.3 * runs);
  const entry = (at: number) => ({
    runId: RunId.of(`run_${at}`),
    taskId: TaskId.of(`task_${at}`),
  });

  return HeldOutSplit.rehydrate({
    searched: Array.from({ length: runs - heldOutCount }, (_, at) =>
      entry(heldOutCount + at),
    ),
    heldOut: Array.from({ length: heldOutCount }, (_, at) => entry(at)),
  });
};

const CEILINGS = [1, 3.33, 10, 47.123457, 250, 1000];

const RUN_COUNTS = [5, 6, 8, 13, 21, 34, 50];

const everyBudget = function* () {
  for (let iterations = 1; iterations <= MAX_ITERATIONS; iterations += 1) {
    for (let k = 1; k <= MAX_PER_ITERATION; k += 1) {
      for (const ceiling of CEILINGS) {
        for (const runs of RUN_COUNTS) {
          yield {
            budget: aBudget({ iterations, perIteration: k, ceiling }),
            split: splitOf(runs),
          };
        }
      }
    }
  }
};

const ceilingSplitOrRejected = (budget: SearchBudget, split: HeldOutSplit) => {
  try {
    return budget.splitCeiling(split, false);
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidSearchError);
    return null;
  }
};

describe('SearchBudget', () => {
  it(`runs its agent 1 to ${MAX_ITERATIONS} times, taking 1 to ${MAX_PER_ITERATION} candidates from each, ${SEARCH_CONCURRENCY} replay runs at once unless told`, () => {
    expect(aBudget().concurrency).toBe(SEARCH_CONCURRENCY);
    expect(aBudget().repeats).toBe(1);
    expect(aBudget({ repeats: 5 }).repeats).toBe(5);
    expect(aBudget({ concurrency: MAX_CONCURRENCY }).concurrency).toBe(
      MAX_CONCURRENCY,
    );

    for (const invalid of [
      { iterations: 0 },
      { iterations: MAX_ITERATIONS + 1 },
      { iterations: 1.5 },
      { perIteration: 0 },
      { perIteration: MAX_PER_ITERATION + 1 },
      { concurrency: MAX_CONCURRENCY + 1 },
      { repeats: 6 },
      { repeats: 1.5 },
    ]) {
      expect(() => aBudget(invalid)).toThrow(InvalidSearchError);
    }
    expect(() =>
      SearchBudget.of({
        iterations: 1,
        perIteration: 1,
        ceiling: Money.of(0, 'USD'),
      }),
    ).toThrow(InvalidMoneyError);
  });

  it('shares what its replays may spend out per run, keeping a margin of its concurrency for each replay and a tenth for its agent', () => {
    const split = splitOf(10);
    const ceilingSplit = aBudget({
      iterations: 2,
      perIteration: 2,
      ceiling: 100,
    }).splitCeiling(split, false);
    const units = 10 + 4 + 2 * 2 * (7 + 4) + 2 * (3 + 3);

    expect(ceilingSplit.agentRuns.amount).toBe(10);
    expect(ceilingSplit.agentRun.amount).toBe(5);
    expect(ceilingSplit.perRun.amount).toBeCloseTo(90 / units, 5);
    expect(ceilingSplit.seed.equals(ceilingSplit.perRun.scaled(10, 1))).toBe(
      true,
    );
    expect(
      ceilingSplit.searchReplay.equals(ceilingSplit.perRun.scaled(7, 1)),
    ).toBe(true);
    expect(
      ceilingSplit.heldOutReplay.equals(ceilingSplit.perRun.scaled(3, 1)),
    ).toBe(true);
    expect(
      ceilingSplit.heldOutReserve.equals(
        ceilingSplit.perRun.scaled(2 * (3 + 3), 1),
      ),
    ).toBe(true);
    expect(
      ceilingSplit.iteration.equals(
        ceilingSplit.perRun.scaled(2 * (7 + 4), 1).plus(ceilingSplit.agentRun),
      ),
    ).toBe(true);
  });

  it('keeps a wider margin the more runs it runs at once', () => {
    const split = splitOf(20);
    const narrow = aBudget({ concurrency: 1 }).splitCeiling(split, false);
    const wide = aBudget({ concurrency: 10 }).splitCeiling(split, false);

    expect(wide.perRun.amount).toBeLessThan(narrow.perRun.amount);
  });

  it('never splits more than its ceiling, margins included, over every shape of search', () => {
    let checked = 0;

    for (const { budget, split } of everyBudget()) {
      const ceilingSplit = ceilingSplitOrRejected(budget, split);

      if (!ceilingSplit) {
        continue;
      }

      const k = budget.perIteration;
      const margin = (runs: number) => Math.min(budget.concurrency, runs);
      const everything = ceilingSplit.seed
        .plus(ceilingSplit.perRun.scaled(margin(split.runs), 1))
        .plus(
          ceilingSplit.perRun.scaled(
            budget.iterations *
              k *
              (split.searched.length + margin(split.searched.length)),
            1,
          ),
        )
        .plus(ceilingSplit.heldOutReserve)
        .plus(ceilingSplit.agentRuns);

      expect(ceilingSplit.perRun.amount).toBeGreaterThanOrEqual(0.01);
      expect(
        ceilingSplit.searchReplay
          .scaled(budget.iterations * k, 1)
          .isWithin(everything),
      ).toBe(true);
      expect(everything.isWithin(budget.ceiling)).toBe(true);
      checked += 1;
    }

    expect(checked).toBeGreaterThan(1000);
  });

  it('runs every iteration it has when each replay overshoots by no more than its margin', () => {
    for (const { budget, split } of everyBudget()) {
      const ceilingSplit = ceilingSplitOrRejected(budget, split);

      if (!ceilingSplit) {
        continue;
      }

      let spent = ceilingSplit.seed.plus(
        ceilingSplit.perRun.scaled(Math.min(budget.concurrency, split.runs), 1),
      );
      let iterations = 0;

      while (budget.allowsIteration(spent, split, false)) {
        spent = spent.plus(ceilingSplit.iteration);
        iterations += 1;
      }

      expect(iterations).toBeGreaterThanOrEqual(budget.iterations);
      expect(
        spent.plus(ceilingSplit.heldOutReserve).isWithin(budget.ceiling),
      ).toBe(true);
    }
  });

  it('starts no more iterations once an agent run overspent its share', () => {
    const split = splitOf(10);
    const budget = aBudget({ iterations: 5, perIteration: 2, ceiling: 20 });
    const ceilingSplit = budget.splitCeiling(split, false);
    const overspent = ceilingSplit.seed
      .plus(ceilingSplit.iteration)
      .plus(Money.of(15, 'USD'));

    expect(budget.allowsIteration(ceilingSplit.seed, split, false)).toBe(true);
    expect(budget.allowsIteration(overspent, split, false)).toBe(false);
  });

  it('rejects a ceiling too low to give each replay run a cent', () => {
    expect(() =>
      aBudget({ iterations: 10, perIteration: 5, ceiling: 1 }).splitCeiling(
        splitOf(50),
        false,
      ),
    ).toThrow(InvalidSearchError);
  });

  it('lets a calibrating seed replay every run three times, and keeps as much again for the replay handed the answer', () => {
    const budget = aBudget({ iterations: 2, perIteration: 2, ceiling: 20 });
    const split = splitOf(10);
    const calibrating = budget.splitCeiling(split, true);

    expect(budget.seedRepeats(true)).toBe(3);
    expect(budget.seedRepeats(false)).toBe(1);
    expect(calibrating.seed).toEqual(calibrating.perRun.scaled(30, 1));
    expect(calibrating.oracle).toEqual(calibrating.seed);
    expect(budget.splitCeiling(split, false).oracle.amount).toBe(0);
    expect(calibrating.perRun.amount).toBeLessThan(
      budget.splitCeiling(split, false).perRun.amount,
    );
  });

  it('never splits more than its ceiling when its seed calibrates, the reserve for the answer included', () => {
    let checked = 0;

    for (const { budget, split } of everyBudget()) {
      if (!budget.affords(split, true)) {
        continue;
      }

      const ceilingSplit = budget.splitCeiling(split, true);
      const k = budget.perIteration;
      const margin = (runs: number) => Math.min(budget.concurrency, runs);
      const seeded = split.runs * budget.seedRepeats(true);
      const everything = ceilingSplit.seed
        .plus(ceilingSplit.perRun.scaled(margin(seeded), 1))
        .plus(ceilingSplit.oracle)
        .plus(ceilingSplit.perRun.scaled(margin(seeded), 1))
        .plus(
          ceilingSplit.perRun.scaled(
            budget.iterations *
              k *
              (split.searched.length + margin(split.searched.length)),
            1,
          ),
        )
        .plus(ceilingSplit.heldOutReserve)
        .plus(ceilingSplit.agentRuns);

      expect(everything.isWithin(budget.ceiling)).toBe(true);
      checked += 1;
    }

    expect(checked).toBeGreaterThan(1000);
  });

  it('keeps the reserve for the answer out of what its iterations may spend', () => {
    const budget = aBudget({ iterations: 1, perIteration: 1, ceiling: 10 });
    const split = splitOf(10);
    const { oracle, heldOutReserve, iteration } = budget.splitCeiling(
      split,
      true,
    );
    const spent = Money.of(
      budget.ceiling.amount -
        oracle.plus(heldOutReserve).plus(iteration).amount,
      'USD',
    );

    expect(budget.allowsIteration(spent, split, true)).toBe(true);
    expect(
      budget.allowsIteration(spent.plus(Money.of(0.01, 'USD')), split, true),
    ).toBe(false);
  });

  it('cannot afford a calibrating seed when its ceiling only covers a plain one', () => {
    const budget = aBudget({ iterations: 10, perIteration: 5, ceiling: 8 });
    const split = splitOf(13);

    expect(budget.affords(split, false)).toBe(true);
    expect(budget.affords(split, true)).toBe(false);
  });
});
