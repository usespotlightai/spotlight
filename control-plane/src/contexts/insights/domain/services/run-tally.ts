import type { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import {
  medianOf,
  percentileOf,
  rateOf,
  spendingOf,
} from '@insights/domain/services/measures';
import {
  type Delta,
  deltaOf,
  spendDeltaOf,
} from '@insights/domain/value-objects/delta.vo';
import type { Money } from '@insights/domain/value-objects/run-usage.vo';

export interface RunTally {
  readonly runs: number;
  readonly cancelled: number;
  readonly failed: number;
  readonly failedRate: number | null;
  readonly stopped: number;
  readonly checksPassed: number;
  readonly checksFailed: number;
  readonly accepted: number;
  readonly sentBack: number;
  readonly passed: number;
  readonly merged: number;
  readonly cost: Money | null;
  readonly unpriced: number;
  readonly mixedCurrencies: boolean;
  readonly medianMs: number | null;
  readonly p90Ms: number | null;
}

const count = (
  records: readonly RunRecord[],
  matches: (record: RunRecord) => boolean,
): number => records.filter(matches).length;

export const runTally = (
  records: readonly RunRecord[],
  taskPullRequests: readonly TaskPullRequest[],
): RunTally => {
  const ran = records.filter((each) => each.ran);
  const tasks = new Set(
    ran.flatMap((each) => (each.taskId ? [each.taskId.value] : [])),
  );
  const spending = spendingOf(ran.map((each) => each.usage?.spend ?? null));
  const took = ran.flatMap((each) =>
    each.usage?.ms === null || each.usage?.ms === undefined
      ? []
      : [each.usage.ms],
  );

  const failed = count(ran, (each) => each.ending === 'failed');

  return {
    runs: ran.length,
    cancelled: count(records, (each) => each.hasEnded && !each.ran),
    failed,
    failedRate: rateOf(failed, ran.length),
    stopped: count(ran, (each) => each.ending === 'stopped'),
    checksPassed: count(ran, (each) => each.checks === 'passed'),
    checksFailed: count(ran, (each) => each.checks === 'failed'),
    accepted: count(ran, (each) => each.firstHumanAction?.accepts === true),
    sentBack: count(ran, (each) => each.firstHumanAction?.sendsBack === true),
    passed: count(ran, (each) => each.passed !== null),
    merged: taskPullRequests.filter(
      (each) => each.merged && tasks.has(each.taskId.value),
    ).length,
    cost: spending.spend,
    unpriced: spending.unpriced,
    mixedCurrencies: spending.mixedCurrencies,
    medianMs: medianOf(took),
    p90Ms: percentileOf(took, 90),
  };
};

export type TallyCounts = Omit<RunTally, 'failedRate'>;

export const NO_RUNS: TallyCounts = {
  runs: 0,
  cancelled: 0,
  failed: 0,
  stopped: 0,
  checksPassed: 0,
  checksFailed: 0,
  accepted: 0,
  sentBack: 0,
  passed: 0,
  merged: 0,
  cost: null,
  unpriced: 0,
  mixedCurrencies: false,
  medianMs: null,
  p90Ms: null,
};

export const tallyOf = (counts: TallyCounts): RunTally => ({
  runs: counts.runs,
  cancelled: counts.cancelled,
  failed: counts.failed,
  failedRate: rateOf(counts.failed, counts.runs),
  stopped: counts.stopped,
  checksPassed: counts.checksPassed,
  checksFailed: counts.checksFailed,
  accepted: counts.accepted,
  sentBack: counts.sentBack,
  passed: counts.passed,
  merged: counts.merged,
  cost: counts.cost,
  unpriced: counts.unpriced,
  mixedCurrencies: counts.mixedCurrencies,
  medianMs: counts.medianMs,
  p90Ms: counts.p90Ms,
});

export interface TallyDeltas {
  readonly runs: Delta | null;
  readonly failed: Delta | null;
  readonly accepted: Delta | null;
  readonly sentBack: Delta | null;
  readonly merged: Delta | null;
  readonly cost: Delta | null;
  readonly median: Delta | null;
}

export const tallyDeltasOf = (
  now: RunTally,
  before: RunTally,
): TallyDeltas => ({
  runs: deltaOf(now.runs, before.runs, { better: 'neither', unit: 'percent' }),
  failed: deltaOf(now.failed, before.failed, {
    better: 'down',
    unit: 'percent',
  }),
  accepted: deltaOf(now.accepted, before.accepted, {
    better: 'up',
    unit: 'percent',
  }),
  sentBack: deltaOf(now.sentBack, before.sentBack, {
    better: 'down',
    unit: 'percent',
  }),
  merged: deltaOf(now.merged, before.merged, {
    better: 'up',
    unit: 'percent',
  }),
  cost: spendDeltaOf(now.cost, before.cost, 'neither'),
  median: deltaOf(now.medianMs, before.medianMs, {
    better: 'down',
    unit: 'percent',
  }),
});

export interface TallySeen {
  readonly accepted: boolean;
  readonly sentBack: boolean;
  readonly merged: boolean;
}

export const tallySeenOf = (now: RunTally, before: RunTally): TallySeen => ({
  accepted: now.accepted > 0 || before.accepted > 0,
  sentBack: now.sentBack > 0 || before.sentBack > 0,
  merged: now.merged > 0 || before.merged > 0,
});

export interface TallyRates {
  readonly checksPassed: number | null;
  readonly accepted: number | null;
  readonly merged: number | null;
}

export const tallyRatesOf = (tally: RunTally): TallyRates => ({
  checksPassed: rateOf(
    tally.checksPassed,
    tally.checksPassed + tally.checksFailed,
  ),
  accepted: rateOf(tally.accepted, tally.runs),
  merged: rateOf(tally.merged, tally.runs),
});

const COUNTED_IN_TALLY = [
  'failed',
  'stopped',
  'checksPassed',
  'checksFailed',
  'accepted',
  'sentBack',
  'passed',
  'merged',
  'cancelled',
] as const;

export type TallyCounted = Readonly<
  Record<(typeof COUNTED_IN_TALLY)[number], boolean>
>;

export const tallyCountedOf = (tally: RunTally): TallyCounted => ({
  failed: tally.failed > 0,
  stopped: tally.stopped > 0,
  checksPassed: tally.checksPassed > 0,
  checksFailed: tally.checksFailed > 0,
  accepted: tally.accepted > 0,
  sentBack: tally.sentBack > 0,
  passed: tally.passed > 0,
  merged: tally.merged > 0,
  cancelled: tally.cancelled > 0,
});
