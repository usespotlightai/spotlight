import { InvalidSearchError } from '@replays/domain/exceptions/invalid-search.error';
import { InvalidSpendError } from '@replays/domain/exceptions/invalid-spend.error';
import { aBudget } from '@replays/domain/replays.fake-spec';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import {
  MAX_CONCURRENCY,
  MAX_ITERATIONS,
  MAX_PER_ITERATION,
  SEARCH_CONCURRENCY,
  SearchBudget,
} from '@replays/domain/value-objects/search-budget.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
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

const allottedOrRejected = (budget: SearchBudget, split: HeldOutSplit) => {
  try {
    return budget.allot(split);
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
        ceiling: Spend.of(0, 'USD'),
      }),
    ).toThrow(InvalidSpendError);
  });

  it('shares what its replays may spend out per run, keeping a margin of its concurrency for each replay and a tenth for its agent', () => {
    const split = splitOf(10);
    const allotted = aBudget({
      iterations: 2,
      perIteration: 2,
      ceiling: 100,
    }).allot(split);
    const units = 10 + 4 + 2 * 2 * (7 + 4) + 2 * (3 + 3);

    expect(allotted.agentRuns.amount).toBe(10);
    expect(allotted.agentRun.amount).toBe(5);
    expect(allotted.perRun.amount).toBeCloseTo(90 / units, 5);
    expect(allotted.seed.equals(allotted.perRun.scaled(10, 1))).toBe(true);
    expect(allotted.searchReplay.equals(allotted.perRun.scaled(7, 1))).toBe(
      true,
    );
    expect(allotted.heldOutReplay.equals(allotted.perRun.scaled(3, 1))).toBe(
      true,
    );
    expect(
      allotted.heldOutReserve.equals(allotted.perRun.scaled(2 * (3 + 3), 1)),
    ).toBe(true);
    expect(
      allotted.iteration.equals(
        allotted.perRun.scaled(2 * (7 + 4), 1).plus(allotted.agentRun),
      ),
    ).toBe(true);
  });

  it('keeps a wider margin the more runs it runs at once', () => {
    const split = splitOf(20);
    const narrow = aBudget({ concurrency: 1 }).allot(split);
    const wide = aBudget({ concurrency: 10 }).allot(split);

    expect(wide.perRun.amount).toBeLessThan(narrow.perRun.amount);
  });

  it('never allots more than its ceiling, margins included, over every shape of search', () => {
    let checked = 0;

    for (const { budget, split } of everyBudget()) {
      const allotted = allottedOrRejected(budget, split);

      if (!allotted) {
        continue;
      }

      const k = budget.perIteration;
      const margin = (runs: number) => Math.min(budget.concurrency, runs);
      const everything = allotted.seed
        .plus(allotted.perRun.scaled(margin(split.runs), 1))
        .plus(
          allotted.perRun.scaled(
            budget.iterations *
              k *
              (split.searched.length + margin(split.searched.length)),
            1,
          ),
        )
        .plus(allotted.heldOutReserve)
        .plus(allotted.agentRuns);

      expect(allotted.perRun.amount).toBeGreaterThanOrEqual(0.01);
      expect(
        allotted.searchReplay
          .scaled(budget.iterations * k, 1)
          .isWithin(everything),
      ).toBe(true);
      expect(everything.isWithin(budget.ceiling)).toBe(true);
      checked += 1;
    }

    expect(checked).toBeGreaterThan(1000);
  });

  it('runs every iteration it was given when each replay overshoots by no more than its margin', () => {
    for (const { budget, split } of everyBudget()) {
      const allotted = allottedOrRejected(budget, split);

      if (!allotted) {
        continue;
      }

      let spent = allotted.seed.plus(
        allotted.perRun.scaled(Math.min(budget.concurrency, split.runs), 1),
      );
      let iterations = 0;

      while (budget.allowsIteration(spent, split)) {
        spent = spent.plus(allotted.iteration);
        iterations += 1;
      }

      expect(iterations).toBeGreaterThanOrEqual(budget.iterations);
      expect(spent.plus(allotted.heldOutReserve).isWithin(budget.ceiling)).toBe(
        true,
      );
    }
  });

  it('starts no more iterations once an agent run overspent its share', () => {
    const split = splitOf(10);
    const budget = aBudget({ iterations: 5, perIteration: 2, ceiling: 20 });
    const allotted = budget.allot(split);
    const overspent = allotted.seed
      .plus(allotted.iteration)
      .plus(Spend.of(15, 'USD'));

    expect(budget.allowsIteration(allotted.seed, split)).toBe(true);
    expect(budget.allowsIteration(overspent, split)).toBe(false);
  });

  it('rejects a ceiling too low to give each replay run a cent', () => {
    expect(() =>
      aBudget({ iterations: 10, perIteration: 5, ceiling: 1 }).allot(
        splitOf(50),
      ),
    ).toThrow(InvalidSearchError);
  });
});
