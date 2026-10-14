import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { rateOf, spendingOf } from '@outcomes/domain/services/measures';
import type { TallyCounts } from '@outcomes/domain/services/run-tally';
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

interface SettledCounts {
  readonly acted: number;
  readonly finished: number;
  readonly finishedTasks: number;
  readonly digested: number;
}

export interface GroupCounts {
  readonly tally: TallyCounts;
  readonly settled: SettledCounts;
}

interface MeasureReading {
  readonly value: number | null;
  readonly settled: number;
  readonly currency: string | null;
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

const verdictFrom = (
  measure: AlertMeasure,
  was: MeasureReading,
  now: MeasureReading,
): MeasureVerdict => {
  const priced = measure === 'cost_per_run';
  const sameMoney = !priced || was.currency === now.currency;

  return {
    measure,
    before: was.value,
    after: now.value,
    settledBefore: was.settled,
    settledAfter: now.settled,
    currency: priced ? (now.currency ?? was.currency) : null,
    verdict: verdictOn(
      measure,
      was.value,
      now.value,
      sameMoney &&
        was.settled >= FEWEST_SETTLED_RUNS &&
        now.settled >= FEWEST_SETTLED_RUNS,
    ),
    change: changeOf(now.value, sameMoney ? was.value : null, {
      better: 'neither',
      unit: priced ? 'percent' : 'points',
    }),
  };
};

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
    currency: currencyOf(held),
  };
};

export const changeVerdictOf = (
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

const readingOfCounts = (
  measure: AlertMeasure,
  { tally, settled }: GroupCounts,
): MeasureReading => {
  const currency = tally.cost?.currency ?? null;

  switch (measure) {
    case 'sent_back_rate':
      return {
        value: rateOf(tally.sentBack, settled.acted),
        settled: settled.acted,
        currency,
      };
    case 'accepted_rate':
      return {
        value: rateOf(tally.accepted, settled.acted),
        settled: settled.acted,
        currency,
      };
    case 'failed_rate':
      return {
        value: rateOf(tally.failed, tally.runs),
        settled: tally.runs,
        currency,
      };
    case 'checks_failed_rate': {
      const checked = tally.checksPassed + tally.checksFailed;

      return {
        value: rateOf(tally.checksFailed, checked),
        settled: checked,
        currency,
      };
    }
    case 'merged_rate':
      return {
        value: rateOf(tally.merged, settled.finishedTasks),
        settled: settled.finished,
        currency,
      };
    case 'cost_per_run':
      return {
        value: tally.cost
          ? rateOf(tally.cost.amount, tally.runs - tally.unpriced)
          : null,
        settled: settled.digested,
        currency,
      };
  }
};

export const verdictsFrom = (
  before: GroupCounts,
  after: GroupCounts,
): readonly MeasureVerdict[] =>
  ALERT_MEASURES.map((measure) =>
    verdictFrom(
      measure,
      readingOfCounts(measure, before),
      readingOfCounts(measure, after),
    ),
  );
