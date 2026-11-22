import {
  type GroupCounts,
  type MeasureVerdict,
  verdictsFrom,
} from '@insights/domain/services/change-verdict';
import { type RunTally, tallyOf } from '@insights/domain/services/run-tally';

export interface UseCount {
  readonly runs: number;
  readonly memories: number;
}

interface CutReadCount {
  readonly memoryId: string;
  readonly runs: number;
}

export interface CutThenRead extends UseCount {
  readonly most: readonly CutReadCount[];
}

export interface MemoryCounts {
  readonly withMemories: GroupCounts;
  readonly withoutMemories: GroupCounts;
  readonly briefed: UseCount;
  readonly read: UseCount;
  readonly recalled: UseCount;
  readonly delivered: UseCount;
  readonly cutThenRead: CutThenRead;
}

export interface MemoryComparison {
  readonly withMemories: RunTally;
  readonly withoutMemories: RunTally;
  readonly verdicts: readonly MeasureVerdict[];
  readonly briefed: UseCount;
  readonly read: UseCount;
  readonly recalled: UseCount;
  readonly delivered: UseCount;
  readonly cutThenRead: CutThenRead;
}

export const memoryComparisonFrom = (
  counts: MemoryCounts,
): MemoryComparison => ({
  withMemories: tallyOf(counts.withMemories.tally),
  withoutMemories: tallyOf(counts.withoutMemories.tally),
  verdicts: verdictsFrom(counts.withoutMemories, counts.withMemories),
  briefed: counts.briefed,
  read: counts.read,
  recalled: counts.recalled,
  delivered: counts.delivered,
  cutThenRead: counts.cutThenRead,
});
