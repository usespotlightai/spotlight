import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import {
  type MeasureReading,
  type MeasureVerdict,
  verdictFrom,
} from '@insights/domain/services/change-verdict';
import { spendingOf } from '@insights/domain/services/measures';
import {
  measuredFor,
  measureOf,
} from '@insights/domain/services/station-measures';
import {
  ALERT_MEASURES,
  type AlertMeasure,
} from '@insights/domain/value-objects/alert-rule.vo';

const readingOfRuns = (
  measure: AlertMeasure,
  records: readonly RunRecord[],
  taskPullRequests: readonly TaskPullRequest[],
): MeasureReading => {
  const measured = measuredFor(measure, taskPullRequests);
  const measuredRuns = records.filter((each) => each.ran && measured(each));

  return {
    value: measureOf(measure, measuredRuns, taskPullRequests),
    measured: measuredRuns.length,
    currency:
      spendingOf(measuredRuns.map((each) => each.usage?.spend ?? null)).spend
        ?.currency ?? null,
  };
};

export const changeVerdictOfRuns = (
  before: readonly RunRecord[],
  after: readonly RunRecord[],
  taskPullRequests: readonly TaskPullRequest[],
): readonly MeasureVerdict[] =>
  ALERT_MEASURES.map((measure) =>
    verdictFrom(
      measure,
      readingOfRuns(measure, before, taskPullRequests),
      readingOfRuns(measure, after, taskPullRequests),
    ),
  );
