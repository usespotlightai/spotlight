import { sha256 } from '@replays/domain/replays.fake-spec';
import { estimateOf } from '@replays/domain/services/search-estimate';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-01T09:00:00.000Z');

const setOf = (runsPerTask: readonly number[]): ReplaySetEntry[] =>
  runsPerTask.flatMap((runs, task) =>
    Array.from({ length: runs }, (_, run) =>
      ReplaySetEntry.of({
        runId: RunId.of(`run_${task}_${run}`),
        taskId: TaskId.of(`task_${task}`),
        addedAt: AT,
      }),
    ),
  );

const allotted = (budget: SearchBudget, split: HeldOutSplit) => {
  try {
    return budget.allot(split);
  } catch {
    return null;
  }
};

describe('estimateOf', () => {
  it('counts every run its budget allows, and times them in waves at its concurrency', () => {
    const budget = SearchBudget.of({
      iterations: 2,
      perIteration: 2,
      ceiling: Spend.ceiling(100, 'USD'),
    });
    const split = HeldOutSplit.costliest(
      setOf([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
      (searched, heldOut) => budget.unitsFor(searched, heldOut),
    );
    const estimate = estimateOf(budget, split, [60_000, 60_000]);

    expect(estimate.runs).toEqual({
      seed: 10,
      searchReplays: 28,
      heldOutReplays: 6,
      agent: 2,
      total: 46,
    });
    expect(estimate.ms).toBe(60_000 * (3 + 2 * (1 + 4) + 2));
    expect(estimateOf(budget, split, []).ms).toBeNull();
  });

  it('counts every copy when each replay replays its runs more than once', () => {
    const once = SearchBudget.of({
      iterations: 2,
      perIteration: 2,
      ceiling: Spend.ceiling(100, 'USD'),
    });
    const thrice = SearchBudget.of({
      iterations: 2,
      perIteration: 2,
      ceiling: Spend.ceiling(100, 'USD'),
      repeats: 3,
    });
    const split = HeldOutSplit.costliest(
      setOf([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
      (searched, heldOut) => once.unitsFor(searched, heldOut),
    );

    expect(estimateOf(thrice, split, []).runs).toEqual({
      seed: 30,
      searchReplays: 84,
      heldOutReplays: 18,
      agent: 2,
      total: 134,
    });
    expect(thrice.allot(split).perRun.amount).toBeLessThan(
      once.allot(split).perRun.amount,
    );
    expect(
      thrice
        .allot(split)
        .searchReplay.equals(
          thrice.allot(split).perRun.scaled(split.searched.length * 3, 1),
        ),
    ).toBe(true);
  });

  it('holds out the tasks that leave each run the smallest share, so no search of the set the estimate accepts is rejected or gets less per run', () => {
    const shapes = [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [5, 1, 1, 1, 1, 1, 1],
      [4, 4, 1, 1, 1, 2, 3, 1],
      [10, 9, 8, 1, 1, 1, 1, 1, 1, 2, 2, 2],
    ];
    let compared = 0;

    for (const shape of shapes) {
      const entries = setOf(shape);

      for (const ceiling of [0.5, 1, 2, 5, 20]) {
        for (const iterations of [1, 3, 10]) {
          const budget = SearchBudget.of({
            iterations,
            perIteration: 5,
            ceiling: Spend.ceiling(ceiling, 'USD'),
            concurrency: 4,
          });
          const worst = HeldOutSplit.costliest(entries, (searched, heldOut) =>
            budget.unitsFor(searched, heldOut),
          );
          const estimated = allotted(budget, worst);

          for (let id = 0; id < 20; id += 1) {
            const drawn = HeldOutSplit.drawn({
              searchId: SearchId.of(`search_${id}`),
              entries,
              digest: sha256,
            });
            const started = allotted(budget, drawn);

            expect(drawn.heldOutTasks).toBe(worst.heldOutTasks);
            if (estimated) {
              expect(started).not.toBeNull();
              expect(
                estimated.perRun.isWithin(started?.perRun ?? estimated.perRun),
              ).toBe(true);
              compared += 1;
            }
          }
        }
      }
    }

    expect(compared).toBeGreaterThan(100);
  });
});
