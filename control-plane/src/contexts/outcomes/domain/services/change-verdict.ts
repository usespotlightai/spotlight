import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import { rateOf } from '@outcomes/domain/services/measures';
import {
  NO_RUNS,
  runTally,
  type TallyCounts,
} from '@outcomes/domain/services/run-tally';
import { settledFor } from '@outcomes/domain/services/station-measures';
import { tasksOf } from '@outcomes/domain/services/team-history';
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

export const NO_GROUP: GroupCounts = {
  tally: NO_RUNS,
  settled: { acted: 0, finished: 0, finishedTasks: 0, digested: 0 },
};

export const groupCountsOf = (
  records: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
): GroupCounts => {
  const { failedShare: _, ...tally } = runTally(records, deliveries);
  const ran = records.filter((each) => each.ran);
  const finished = ran.filter(settledFor('merged_rate', deliveries));

  return {
    tally,
    settled: {
      acted: ran.filter((each) => each.next !== null).length,
      finished: finished.length,
      finishedTasks: tasksOf(finished).length,
      digested: ran.filter((each) => each.cost !== null).length,
    },
  };
};

export interface MeasureReading {
  readonly value: number | null;
  readonly settled: number;
  readonly currency: string | null;
}

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

export const verdictFrom = (
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
