import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  changeVerdictOf,
  type MeasureVerdict,
} from '@outcomes/domain/services/change-verdict';
import { type RunTally, runTally } from '@outcomes/domain/services/run-tally';

export interface MemoryUseOfRun {
  readonly runId: string;
  readonly briefed: number;
  readonly recalled: number;
}

export interface MemoryComparison {
  readonly withMemories: RunTally;
  readonly withoutMemories: RunTally;
  readonly verdicts: readonly MeasureVerdict[];
  readonly runsBriefed: number;
  readonly runsRecalled: number;
}

export const memoryComparisonOf = (
  records: readonly RunRecord[],
  uses: readonly MemoryUseOfRun[],
  deliveries: readonly TaskDelivery[],
): MemoryComparison => {
  const ran = records.filter((each) => each.ran);
  const held = new Set(ran.map((each) => each.runId.value));
  const using = new Map(
    uses
      .filter((each) => held.has(each.runId))
      .map((each) => [each.runId, each]),
  );
  const used = (record: RunRecord): boolean => {
    const use = using.get(record.runId.value);
    return use !== undefined && use.briefed + use.recalled > 0;
  };

  const withMemories = ran.filter(used);
  const withoutMemories = ran.filter((each) => !used(each));

  return {
    withMemories: runTally(withMemories, deliveries),
    withoutMemories: runTally(withoutMemories, deliveries),
    verdicts: changeVerdictOf(withoutMemories, withMemories, deliveries),
    runsBriefed: [...using.values()].filter((each) => each.briefed > 0).length,
    runsRecalled: [...using.values()].filter((each) => each.recalled > 0)
      .length,
  };
};
