import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  medianOf,
  percentileOf,
  spendingOf,
} from '@outcomes/domain/services/measures';
import type { Spend } from '@outcomes/domain/value-objects/run-cost.vo';

export interface RunTally {
  readonly runs: number;
  readonly withdrawn: number;
  readonly failed: number;
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
  holds: (record: RunRecord) => boolean,
): number => records.filter(holds).length;

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

  return {
    runs: ran.length,
    withdrawn: count(records, (each) => each.hasEnded && !each.ran),
    failed: count(ran, (each) => each.ending === 'failed'),
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
