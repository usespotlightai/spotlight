import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  type GroupCounts,
  type MeasureVerdict,
  verdictsFrom,
} from '@outcomes/domain/services/change-verdict';
import {
  type RunTally,
  runTally,
  tallyOf,
} from '@outcomes/domain/services/run-tally';
import { settledFor } from '@outcomes/domain/services/station-measures';
import {
  endedWithin,
  type TeamHistory,
  tasksOf,
} from '@outcomes/domain/services/team-history';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';

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

const groupCountsOf = (
  records: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
): GroupCounts => {
  const { failedShare: _, ...tally } = runTally(records, deliveries);
  const finished = records.filter(settledFor('merged_rate', deliveries));

  return {
    tally,
    settled: {
      acted: records.filter((each) => each.next !== null).length,
      finished: finished.length,
      finishedTasks: tasksOf(finished).length,
      digested: records.filter((each) => each.cost !== null).length,
    },
  };
};

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
      history.deliveries,
    ),
    withoutMemories: groupCountsOf(
      ran.filter((each) => !each.memories.used),
      history.deliveries,
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
