import {
  type GroupCounts,
  groupCountsOf,
  type MeasureVerdict,
  verdictsFrom,
} from '@insights/domain/services/change-verdict';
import { type RunTally, tallyOf } from '@insights/domain/services/run-tally';
import {
  endedWithin,
  type TeamHistory,
} from '@insights/domain/services/team-history';
import type { Window } from '@insights/domain/value-objects/insights-period.vo';

export interface MemoryCounts {
  readonly withMemories: GroupCounts;
  readonly withoutMemories: GroupCounts;
  readonly runsBriefed: number;
  readonly runsRecalled: number;
  readonly memoriesBriefed: number;
  readonly memoriesRecalled: number;
}

export interface MemoryComparison {
  readonly withMemories: RunTally;
  readonly withoutMemories: RunTally;
  readonly verdicts: readonly MeasureVerdict[];
  readonly runsBriefed: number;
  readonly runsRecalled: number;
  readonly memoriesBriefed: number;
  readonly memoriesRecalled: number;
}

const distinct = (memories: readonly (readonly string[])[]): number =>
  new Set(memories.flat()).size;

export const memoryCountsOf = (
  history: TeamHistory,
  window: Window,
): MemoryCounts => {
  const ended = endedWithin(history.records, window);
  const ran = ended.filter((each) => each.ran);

  return {
    withMemories: groupCountsOf(
      ran.filter((each) => each.memories.used),
      history.taskPullRequests,
    ),
    withoutMemories: groupCountsOf(
      ran.filter((each) => !each.memories.used),
      history.taskPullRequests,
    ),
    runsBriefed: ran.filter((each) => each.memories.briefed.length > 0).length,
    runsRecalled: ran.filter((each) => each.memories.recalled.length > 0)
      .length,
    memoriesBriefed: distinct(ended.map((each) => each.memories.briefed)),
    memoriesRecalled: distinct(ended.map((each) => each.memories.recalled)),
  };
};

export const memoryComparisonFrom = (
  counts: MemoryCounts,
): MemoryComparison => ({
  withMemories: tallyOf(counts.withMemories.tally),
  withoutMemories: tallyOf(counts.withoutMemories.tally),
  verdicts: verdictsFrom(counts.withoutMemories, counts.withMemories),
  runsBriefed: counts.runsBriefed,
  runsRecalled: counts.runsRecalled,
  memoriesBriefed: counts.memoriesBriefed,
  memoriesRecalled: counts.memoriesRecalled,
});
