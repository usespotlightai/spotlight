import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  type MeasureReading,
  type MeasureVerdict,
  verdictFrom,
} from '@outcomes/domain/services/change-verdict';
import { spendingOf } from '@outcomes/domain/services/measures';
import {
  measureOf,
  settledFor,
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
  const settled = settledFor(measure, deliveries);
  const held = records.filter((each) => each.ran && settled(each));

  return {
    value: measureOf(measure, held, deliveries),
    settled: held.length,
    currency:
      spendingOf(held.map((each) => each.cost?.spend ?? null)).spend
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
