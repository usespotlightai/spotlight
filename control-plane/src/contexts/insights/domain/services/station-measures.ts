import { rateOf, spendingOf } from '@insights/domain/services/measures';
import { runTally } from '@insights/domain/services/run-tally';
import type {
  AlertMeasure,
  AlertRule,
  FinalReading,
} from '@insights/domain/value-objects/alert-rule.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const UNMEASURED_SLACK = 4;

export const runsToReadFor = (rules: readonly AlertRule[]): number =>
  Math.max(0, ...rules.map((each) => each.runsNeeded)) * UNMEASURED_SLACK;

export interface MeasurePoint {
  readonly runId: string;
  readonly endedAt: Date;
  readonly value: number | null;
}

const endedAt = (fact: RunFact): number => fact.end.endedAt.getTime();

const tasksRunBy = (facts: readonly RunFact[]): number =>
  new Set(facts.map((each) => each.taskId.value)).size;

const ranNewestFirst = (facts: readonly RunFact[]): readonly RunFact[] =>
  facts
    .filter((each) => each.ran)
    .sort(
      (a, b) =>
        endedAt(b) - endedAt(a) || b.runId.value.localeCompare(a.runId.value),
    );

export const measuredFor = (
  measure: AlertMeasure,
): ((fact: RunFact) => boolean) => {
  switch (measure) {
    case 'sent_back_rate':
    case 'accepted_rate':
      return (fact) => fact.resolution !== 'other';
    case 'checks_failed_rate':
      return (fact) => fact.checks === 'passed' || fact.checks === 'failed';
    case 'merged_rate':
      return (fact) => fact.pullRequestFinished;
    case 'failed_rate':
      return () => true;
    case 'cost_per_run':
      return (fact) => fact.usage !== null;
  }
};

const measuredNewestFirst = (
  measure: AlertMeasure,
  facts: readonly RunFact[],
): readonly RunFact[] => ranNewestFirst(facts).filter(measuredFor(measure));

export const measureOf = (
  measure: AlertMeasure,
  facts: readonly RunFact[],
): number | null => {
  const tally = runTally(facts);

  switch (measure) {
    case 'sent_back_rate':
      return rateOf(tally.resolutions.sentBack, tally.runs);
    case 'accepted_rate':
      return rateOf(tally.resolutions.accepted, tally.runs);
    case 'failed_rate':
      return rateOf(tally.failed, tally.runs);
    case 'checks_failed_rate':
      return rateOf(
        tally.checksFailed,
        tally.checksPassed + tally.checksFailed,
      );
    case 'merged_rate':
      return rateOf(tally.merged, tasksRunBy(facts.filter((each) => each.ran)));
    case 'cost_per_run': {
      const spending = spendingOf(
        facts
          .filter((each) => each.ran)
          .map((each) => each.usage?.spend ?? null),
      );

      return spending.spend
        ? rateOf(spending.spend.amount, spending.priced)
        : null;
    }
  }
};

export const readingOf = (
  rule: AlertRule,
  newestFirst: readonly RunFact[],
): FinalReading | null => {
  const ran = measuredNewestFirst(rule.measure, newestFirst);
  const last = ran.slice(0, rule.over);
  const through = last[0];

  if (last.length < rule.over || !through) {
    return null;
  }

  const newest = { runId: through.runId, taskId: through.taskId };

  const value = measureOf(rule.measure, last);

  if (value === null) {
    return null;
  }
  if (!rule.compares) {
    return { value, baseline: null, ...newest };
  }

  const before = ran.slice(rule.over, rule.over * 2);
  const baseline =
    before.length < rule.over ? null : measureOf(rule.measure, before);

  return baseline === null ? null : { value, baseline, ...newest };
};

const ALERT_CHART_LEAD = 2;

const ALERT_CHART_TRAIL = 1;

export const measureAround = (
  rule: AlertRule,
  pinned: { readonly runId: RunId; readonly value: number },
  newestFirst: readonly RunFact[],
): readonly MeasurePoint[] => {
  const oldestFirst = [
    ...measuredNewestFirst(rule.measure, newestFirst),
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

  return oldestFirst.slice(from, to).map((fact, offset) => {
    const upTo = from + offset + 1;
    const window = oldestFirst.slice(Math.max(0, upTo - rule.over), upTo);

    return {
      runId: fact.runId.value,
      endedAt: fact.end.endedAt,
      value: fact.runId.equals(pinned.runId)
        ? pinned.value
        : window.length < rule.over
          ? null
          : measureOf(rule.measure, window),
    };
  });
};
