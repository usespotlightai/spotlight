import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { spendingOf } from '@outcomes/domain/services/measures';
import {
  measureOf,
  settledFor,
} from '@outcomes/domain/services/station-measures';
import {
  ALERT_MEASURES,
  type AlertMeasure,
} from '@outcomes/domain/value-objects/alert-rule.vo';
import {
  type Change,
  changeOf,
} from '@outcomes/domain/value-objects/change.vo';

export const FEWEST_SETTLED_RUNS = 5;

export const VERDICTS = [
  'better',
  'worse',
  'unchanged',
  'insufficient',
] as const;

type Verdict = (typeof VERDICTS)[number];

const HIGHER_IS_BETTER: ReadonlySet<AlertMeasure> = new Set([
  'accepted_rate',
  'merged_rate',
]);

const LEEWAY = 1e-9;

export interface MeasureVerdict {
  readonly measure: AlertMeasure;
  readonly before: number | null;
  readonly after: number | null;
  readonly settledBefore: number;
  readonly settledAfter: number;
  readonly currency: string | null;
  readonly verdict: Verdict;
  readonly change: Change | null;
}

const currencyOf = (records: readonly RunRecord[]): string | null =>
  spendingOf(records.map((each) => each.cost?.spend ?? null)).spend?.currency ??
  null;

const verdictOn = (
  measure: AlertMeasure,
  before: number | null,
  after: number | null,
  enough: boolean,
): Verdict => {
  if (!enough || before === null || after === null) {
    return 'insufficient';
  }
  if (Math.abs(after - before) <= LEEWAY) {
    return 'unchanged';
  }

  return after > before === HIGHER_IS_BETTER.has(measure) ? 'better' : 'worse';
};

export const changeVerdictOf = (
  before: readonly RunRecord[],
  after: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
): readonly MeasureVerdict[] =>
  ALERT_MEASURES.map((measure) => {
    const settled = settledFor(measure, deliveries);
    const was = before.filter((each) => each.ran && settled(each));
    const now = after.filter((each) => each.ran && settled(each));
    const wasValue = measureOf(measure, was, deliveries);
    const nowValue = measureOf(measure, now, deliveries);
    const priced = measure === 'cost_per_run';
    const sameMoney = !priced || currencyOf(was) === currencyOf(now);
    const comparable = sameMoney ? wasValue : null;

    return {
      measure,
      before: wasValue,
      after: nowValue,
      settledBefore: was.length,
      settledAfter: now.length,
      currency: priced ? (currencyOf(now) ?? currencyOf(was)) : null,
      verdict: verdictOn(
        measure,
        wasValue,
        nowValue,
        sameMoney &&
          was.length >= FEWEST_SETTLED_RUNS &&
          now.length >= FEWEST_SETTLED_RUNS,
      ),
      change: changeOf(nowValue, comparable, {
        better: 'neither',
        unit: priced ? 'percent' : 'points',
      }),
    };
  });
