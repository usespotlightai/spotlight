import { type GroupCounts } from '@insights/domain/services/change-verdict';
import { runTally } from '@insights/domain/services/run-tally';
import { measuredFor } from '@insights/domain/services/station-measures';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';

export const groupCountsOfFacts = (facts: readonly RunFact[]): GroupCounts => {
  const { failedRate: _, ...tally } = runTally(facts);
  const ran = facts.filter((each) => each.ran);
  const finished = ran.filter(measuredFor('merged_rate'));

  return {
    tally,
    measured: {
      decided: ran.filter(measuredFor('accepted_rate')).length,
      finished: finished.length,
      finishedTasks: new Set(finished.map((each) => each.taskId.value)).size,
      usageRecorded: ran.filter((each) => each.usage !== null).length,
    },
  };
};
