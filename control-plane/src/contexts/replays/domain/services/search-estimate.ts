import type { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import type {
  SearchAllotment,
  SearchBudget,
} from '@replays/domain/value-objects/search-budget.vo';

export interface SearchEstimate {
  readonly runs: {
    readonly seed: number;
    readonly searchReplays: number;
    readonly heldOutReplays: number;
    readonly agent: number;
    readonly total: number;
  };
  readonly allotment: SearchAllotment;
  readonly ms: number | null;
}

const average = (values: readonly number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((sum, each) => sum + each, 0) / values.length;

export const estimateOf = (
  budget: SearchBudget,
  split: HeldOutSplit,
  timed: readonly number[],
): SearchEstimate => {
  const allotment = budget.allot(split);
  const k = budget.perIteration;
  const searched = split.searched.length * budget.repeats;
  const heldOut = split.heldOut.length * budget.repeats;
  const seed = split.runs * budget.repeats;
  const runs = {
    seed,
    searchReplays: budget.iterations * k * searched,
    heldOutReplays: k * heldOut,
    agent: budget.iterations,
  };
  const waves = (count: number) => Math.ceil(count / budget.concurrency);
  const each = average(timed);

  return {
    runs: {
      ...runs,
      total: runs.seed + runs.searchReplays + runs.heldOutReplays + runs.agent,
    },
    allotment,
    ms:
      each === null
        ? null
        : Math.round(
            each *
              (waves(seed) +
                budget.iterations * (1 + waves(k * searched)) +
                waves(k * heldOut)),
          ),
  };
};
