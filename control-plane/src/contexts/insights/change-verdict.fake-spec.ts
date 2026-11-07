import {
  type GroupCounts,
  type MeasureReading,
  type MeasureVerdict,
  verdictFrom,
} from '@insights/domain/services/change-verdict';
import { spendingOf } from '@insights/domain/services/measures';
import { runTally } from '@insights/domain/services/run-tally';
import {
  measuredFor,
  measureOf,
} from '@insights/domain/services/station-measures';
import {
  ALERT_MEASURES,
  type AlertMeasure,
} from '@insights/domain/value-objects/alert-rule.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';

const readingOfRuns = (
  measure: AlertMeasure,
  facts: readonly RunFact[],
): MeasureReading => {
  const measured = measuredFor(measure);
  const measuredRuns = facts.filter((each) => each.ran && measured(each));

  return {
    value: measureOf(measure, measuredRuns),
    measured: measuredRuns.length,
    currency:
      spendingOf(measuredRuns.map((each) => each.usage?.spend ?? null)).spend
        ?.currency ?? null,
  };
};

export const changeVerdictOfRuns = (
  before: readonly RunFact[],
  after: readonly RunFact[],
): readonly MeasureVerdict[] =>
  ALERT_MEASURES.map((measure) =>
    verdictFrom(
      measure,
      readingOfRuns(measure, before),
      readingOfRuns(measure, after),
    ),
  );

export const groupCountsOfFacts = (facts: readonly RunFact[]): GroupCounts => {
  const { failedRate: _, ...tally } = runTally(facts);
  const ran = facts.filter((each) => each.ran);
  const finished = ran.filter(measuredFor('merged_rate'));

  return {
    tally,
    measured: {
      acted: ran.filter((each) => each.firstHumanAction !== null).length,
      finished: finished.length,
      finishedTasks: new Set(finished.map((each) => each.taskId.value)).size,
      usageRecorded: ran.filter((each) => each.usage !== null).length,
    },
  };
};
