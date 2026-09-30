import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import type {
  RunCost,
  Spend,
} from '@outcomes/domain/value-objects/run-cost.vo';

export interface StationTally {
  readonly runs: number;
  readonly withdrawn: number;
  readonly failed: number;
  readonly stopped: number;
  readonly checksPassed: number;
  readonly checksFailed: number;
  readonly accepted: number;
  readonly sentBack: number;
  readonly merged: number;
  readonly cost: Spend | null;
  readonly medianMs: number | null;
}

const medianOf = (values: readonly number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
};

const spentBy = (costs: readonly RunCost[]): Spend | null => {
  const spends = costs.flatMap((each) => (each.spend ? [each.spend] : []));
  const [first] = spends;

  if (!first || spends.some((each) => each.currency !== first.currency)) {
    return null;
  }

  return {
    amount: spends.reduce((sum, each) => sum + each.amount, 0),
    currency: first.currency,
  };
};

const count = (
  records: readonly RunRecord[],
  holds: (record: RunRecord) => boolean,
): number => records.filter(holds).length;

export const stationTally = (
  records: readonly RunRecord[],
  deliveries: readonly TaskDelivery[],
  costs: ReadonlyMap<string, RunCost>,
): StationTally => {
  const ran = records.filter((each) => each.ran);
  const tasks = new Set(
    ran.flatMap((each) => (each.taskId ? [each.taskId.value] : [])),
  );
  const spent = ran.flatMap((each) => {
    const cost = costs.get(each.runId.value);
    return cost ? [cost] : [];
  });

  return {
    runs: ran.length,
    withdrawn: count(records, (each) => each.hasEnded && !each.ran),
    failed: count(ran, (each) => each.ending === 'failed'),
    stopped: count(ran, (each) => each.ending === 'stopped'),
    checksPassed: count(ran, (each) => each.checks === 'passed'),
    checksFailed: count(ran, (each) => each.checks === 'failed'),
    accepted: count(ran, (each) => each.next?.accepts === true),
    sentBack: count(ran, (each) => each.next?.sendsBack === true),
    merged: deliveries.filter(
      (each) => each.state === 'merged' && tasks.has(each.taskId.value),
    ).length,
    cost: spentBy(spent),
    medianMs: medianOf(
      spent.flatMap((each) => (each.ms === null ? [] : [each.ms])),
    ),
  };
};
