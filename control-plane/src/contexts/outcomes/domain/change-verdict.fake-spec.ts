import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  type MeasureReading,
  type MeasureVerdict,
  verdictFrom,
} from '@outcomes/domain/services/change-verdict';
import { spendingOf } from '@outcomes/domain/services/measures';
import {
  measuredFor,
  measureOf,
} from '@outcomes/domain/services/station-measures';
import {
  ALERT_MEASURES,
  type AlertMeasure,
} from '@outcomes/domain/value-objects/alert-rule.vo';

const readingOfRuns = (
  measure: AlertMeasure,
  records: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
): MeasureReading => {
  const measured = measuredFor(measure, deliveries);
  const measuredRuns = records.filter((each) => each.ran && measured(each));

  return {
    value: measureOf(measure, measuredRuns, deliveries),
    measured: measuredRuns.length,
    currency:
      spendingOf(measuredRuns.map((each) => each.cost?.spend ?? null)).spend
        ?.currency ?? null,
  };
};

export const changeVerdictOfRuns = (
  before: readonly RunRecord[],
  after: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
): readonly MeasureVerdict[] =>
  ALERT_MEASURES.map((measure) =>
    verdictFrom(
      measure,
      readingOfRuns(measure, before, deliveries),
      readingOfRuns(measure, after, deliveries),
    ),
  );
