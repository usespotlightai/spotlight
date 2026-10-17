import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  medianOf,
  percentileOf,
  rateOf,
  spendingOf,
} from '@outcomes/domain/services/measures';
import {
  type Change,
  changeOf,
  spendChangeOf,
} from '@outcomes/domain/value-objects/change.vo';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';

export interface RunTally {
  readonly runs: number;
  readonly withdrawn: number;
  readonly failed: number;
  readonly failedShare: number | null;
  readonly stopped: number;
  readonly checksPassed: number;
  readonly checksFailed: number;
  readonly accepted: number;
  readonly sentBack: number;
  readonly handedOn: number;
  readonly merged: number;
  readonly cost: Spend | null;
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
  deliveries: readonly TaskDelivery[],
): RunTally => {
  const ran = records.filter((each) => each.ran);
  const tasks = new Set(
    ran.flatMap((each) => (each.taskId ? [each.taskId.value] : [])),
  );
  const spending = spendingOf(ran.map((each) => each.cost?.spend ?? null));
  const took = ran.flatMap((each) =>
    each.cost?.ms === null || each.cost?.ms === undefined ? [] : [each.cost.ms],
  );

  const failed = count(ran, (each) => each.ending === 'failed');

  return {
    runs: ran.length,
    withdrawn: count(records, (each) => each.hasEnded && !each.ran),
    failed,
    failedShare: rateOf(failed, ran.length),
    stopped: count(ran, (each) => each.ending === 'stopped'),
    checksPassed: count(ran, (each) => each.checks === 'passed'),
    checksFailed: count(ran, (each) => each.checks === 'failed'),
    accepted: count(ran, (each) => each.next?.accepts === true),
    sentBack: count(ran, (each) => each.next?.sendsBack === true),
    handedOn: count(ran, (each) => each.handedOn !== null),
    merged: deliveries.filter(
      (each) => each.merged && tasks.has(each.taskId.value),
    ).length,
    cost: spending.spend,
    unpriced: spending.unpriced,
    mixedCurrencies: spending.mixedCurrencies,
    medianMs: medianOf(took),
    p90Ms: percentileOf(took, 90),
  };
};

export type TallyCounts = Omit<RunTally, 'failedShare'>;

export const NO_RUNS: TallyCounts = {
  runs: 0,
  withdrawn: 0,
  failed: 0,
  stopped: 0,
  checksPassed: 0,
  checksFailed: 0,
  accepted: 0,
  sentBack: 0,
  handedOn: 0,
  merged: 0,
  cost: null,
  unpriced: 0,
  mixedCurrencies: false,
  medianMs: null,
  p90Ms: null,
};

export const tallyOf = (counts: TallyCounts): RunTally => ({
  runs: counts.runs,
  withdrawn: counts.withdrawn,
  failed: counts.failed,
  failedShare: rateOf(counts.failed, counts.runs),
  stopped: counts.stopped,
  checksPassed: counts.checksPassed,
  checksFailed: counts.checksFailed,
  accepted: counts.accepted,
  sentBack: counts.sentBack,
  handedOn: counts.handedOn,
  merged: counts.merged,
  cost: counts.cost,
  unpriced: counts.unpriced,
  mixedCurrencies: counts.mixedCurrencies,
  medianMs: counts.medianMs,
  p90Ms: counts.p90Ms,
});

export interface TallyChanges {
  readonly runs: Change | null;
  readonly failed: Change | null;
  readonly accepted: Change | null;
  readonly sentBack: Change | null;
  readonly merged: Change | null;
  readonly cost: Change | null;
  readonly median: Change | null;
}

export const tallyChangesOf = (
  now: RunTally,
  before: RunTally,
): TallyChanges => ({
  runs: changeOf(now.runs, before.runs, { better: 'neither', unit: 'percent' }),
  failed: changeOf(now.failed, before.failed, {
    better: 'down',
    unit: 'percent',
  }),
  accepted: changeOf(now.accepted, before.accepted, {
    better: 'up',
    unit: 'percent',
  }),
  sentBack: changeOf(now.sentBack, before.sentBack, {
    better: 'down',
    unit: 'percent',
  }),
  merged: changeOf(now.merged, before.merged, {
    better: 'up',
    unit: 'percent',
  }),
  cost: spendChangeOf(now.cost, before.cost, 'neither'),
  median: changeOf(now.medianMs, before.medianMs, {
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

export interface TallyShares {
  readonly checksPassed: number | null;
  readonly accepted: number | null;
  readonly merged: number | null;
}

export const tallySharesOf = (tally: RunTally): TallyShares => ({
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
  'handedOn',
  'merged',
  'withdrawn',
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
  handedOn: tally.handedOn > 0,
  merged: tally.merged > 0,
  withdrawn: tally.withdrawn > 0,
});
