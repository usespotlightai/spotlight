import {
  type GroupCounts,
  type MeasureVerdict,
  verdictsFrom,
} from '@insights/domain/services/change-verdict';
import { type RunTally, tallyOf } from '@insights/domain/services/run-tally';

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
