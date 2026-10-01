import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { rateOf, spendingOf } from '@outcomes/domain/services/measures';
import { runTally } from '@outcomes/domain/services/run-tally';
import { tasksOf } from '@outcomes/domain/services/team-history';
import type {
  AlertMeasure,
  AlertRule,
  SettledReading,
} from '@outcomes/domain/value-objects/alert-rule.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface MeasurePoint {
  readonly runId: string;
  readonly endedAt: Date;
  readonly value: number | null;
}

const endedAt = (record: RunRecord): number =>
  record.end?.endedAt.getTime() ?? 0;

const ranNewestFirst = (records: readonly RunRecord[]): readonly RunRecord[] =>
  records
    .filter((each) => each.ran)
    .sort(
      (a, b) =>
        endedAt(b) - endedAt(a) || b.runId.value.localeCompare(a.runId.value),
    );

export const settledFor = (
  measure: AlertMeasure,
  deliveries: readonly TaskDelivery[],
): ((record: RunRecord) => boolean) => {
  switch (measure) {
    case 'sent_back_rate':
    case 'accepted_rate':
      return (record) => record.next !== null;
    case 'checks_failed_rate':
      return (record) =>
        record.checks === 'passed' || record.checks === 'failed';
    case 'merged_rate':
      return (record) =>
        deliveries.some(
          (each) =>
            record.taskId !== null &&
            each.taskId.equals(record.taskId) &&
            each.finished,
        );
    case 'failed_rate':
      return () => true;
    case 'cost_per_run':
      return (record) => record.cost !== null;
  }
};

const settledNewestFirst = (
  measure: AlertMeasure,
  records: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
): readonly RunRecord[] =>
  ranNewestFirst(records).filter(settledFor(measure, deliveries));

export const measureOf = (
  measure: AlertMeasure,
  records: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
): number | null => {
  const tally = runTally(records, deliveries);

  switch (measure) {
    case 'sent_back_rate':
      return rateOf(tally.sentBack, tally.runs);
    case 'accepted_rate':
      return rateOf(tally.accepted, tally.runs);
    case 'failed_rate':
      return rateOf(tally.failed, tally.runs);
    case 'checks_failed_rate':
      return rateOf(
        tally.checksFailed,
        tally.checksPassed + tally.checksFailed,
      );
    case 'merged_rate':
      return rateOf(
        tally.merged,
        tasksOf(records.filter((each) => each.ran)).length,
      );
    case 'cost_per_run': {
      const spending = spendingOf(
        records
          .filter((each) => each.ran)
          .map((each) => each.cost?.spend ?? null),
      );

      return spending.spend
        ? rateOf(spending.spend.amount, spending.priced)
        : null;
    }
  }
};

export const readingOf = (
  rule: AlertRule,
  newestFirst: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
): SettledReading | null => {
  const ran = settledNewestFirst(rule.measure, newestFirst, deliveries);
  const last = ran.slice(0, rule.over);
  const through = last[0];

  if (last.length < rule.over || !through?.end) {
    return null;
  }

  const newest = { runId: through.runId, taskId: through.end.place.taskId };

  const value = measureOf(rule.measure, last, deliveries);

  if (value === null) {
    return null;
  }
  if (!rule.compares) {
    return { value, baseline: null, ...newest };
  }

  const before = ran.slice(rule.over, rule.over * 2);
  const baseline =
    before.length < rule.over
      ? null
      : measureOf(rule.measure, before, deliveries);

  return baseline === null ? null : { value, baseline, ...newest };
};

const ALERT_CHART_LEAD = 2;

const ALERT_CHART_TRAIL = 1;

export const measureAround = (
  rule: AlertRule,
  pinned: { readonly runId: RunId; readonly value: number },
  newestFirst: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
): readonly MeasurePoint[] => {
  const oldestFirst = [
    ...settledNewestFirst(rule.measure, newestFirst, deliveries),
  ].reverse();
  const at = oldestFirst.findIndex((each) => each.runId.equals(pinned.runId));

  if (at < 0) {
    return [];
  }

  const from = Math.max(0, at - rule.over * ALERT_CHART_LEAD);
  const to = Math.min(
    oldestFirst.length,
    at + rule.over * ALERT_CHART_TRAIL + 1,
  );

  return oldestFirst.slice(from, to).map((record, offset) => {
    const upTo = from + offset + 1;
    const window = oldestFirst.slice(Math.max(0, upTo - rule.over), upTo);

    return {
      runId: record.runId.value,
      endedAt: record.end?.endedAt ?? new Date(0),
      value: record.runId.equals(pinned.runId)
        ? pinned.value
        : window.length < rule.over
          ? null
          : measureOf(rule.measure, window, deliveries),
    };
  });
};
