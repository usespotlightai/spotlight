import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import { rateOf } from '@insights/domain/services/measures';
import {
  NO_RUNS,
  runTally,
  type TallyCounts,
} from '@insights/domain/services/run-tally';
import { measuredFor } from '@insights/domain/services/station-measures';
import { tasksOf } from '@insights/domain/services/team-history';
import {
  ALERT_MEASURES,
  type AlertMeasure,
} from '@insights/domain/value-objects/alert-rule.vo';
import { type Delta, deltaOf } from '@insights/domain/value-objects/delta.vo';

export const MIN_MEASURED_RUNS = 5;

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
  readonly measuredBefore: number;
  readonly measuredAfter: number;
  readonly currency: string | null;
  readonly verdict: Verdict;
  readonly change: Delta | null;
}

interface MeasuredCounts {
  readonly acted: number;
  readonly finished: number;
  readonly finishedTasks: number;
  readonly usageRecorded: number;
}

export interface GroupCounts {
  readonly tally: TallyCounts;
  readonly measured: MeasuredCounts;
}

export const NO_GROUP: GroupCounts = {
  tally: NO_RUNS,
  measured: { acted: 0, finished: 0, finishedTasks: 0, usageRecorded: 0 },
};

export const groupCountsOf = (
  records: readonly RunRecord[],
  taskPullRequests: readonly TaskPullRequest[],
): GroupCounts => {
  const { failedRate: _, ...tally } = runTally(records, taskPullRequests);
  const ran = records.filter((each) => each.ran);
  const finished = ran.filter(measuredFor('merged_rate', taskPullRequests));

  return {
    tally,
    measured: {
      acted: ran.filter((each) => each.firstHumanAction !== null).length,
      finished: finished.length,
      finishedTasks: tasksOf(finished).length,
      usageRecorded: ran.filter((each) => each.usage !== null).length,
    },
  };
};

export interface MeasureReading {
  readonly value: number | null;
  readonly measured: number;
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
    measuredBefore: was.measured,
    measuredAfter: now.measured,
    currency: priced ? (now.currency ?? was.currency) : null,
    verdict: verdictOn(
      measure,
      was.value,
      now.value,
      sameMoney &&
        was.measured >= MIN_MEASURED_RUNS &&
        now.measured >= MIN_MEASURED_RUNS,
    ),
    change: deltaOf(now.value, sameMoney ? was.value : null, {
      better: 'neither',
      unit: priced ? 'percent' : 'points',
    }),
  };
};

const readingOfCounts = (
  measure: AlertMeasure,
  { tally, measured }: GroupCounts,
): MeasureReading => {
  const currency = tally.cost?.currency ?? null;

  switch (measure) {
    case 'sent_back_rate':
      return {
        value: rateOf(tally.sentBack, measured.acted),
        measured: measured.acted,
        currency,
      };
    case 'accepted_rate':
      return {
        value: rateOf(tally.accepted, measured.acted),
        measured: measured.acted,
        currency,
      };
    case 'failed_rate':
      return {
        value: rateOf(tally.failed, tally.runs),
        measured: tally.runs,
        currency,
      };
    case 'checks_failed_rate': {
      const checked = tally.checksPassed + tally.checksFailed;

      return {
        value: rateOf(tally.checksFailed, checked),
        measured: checked,
        currency,
      };
    }
    case 'merged_rate':
      return {
        value: rateOf(tally.merged, measured.finishedTasks),
        measured: measured.finished,
        currency,
      };
    case 'cost_per_run':
      return {
        value: tally.cost
          ? rateOf(tally.cost.amount, tally.runs - tally.unpriced)
          : null,
        measured: measured.usageRecorded,
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
