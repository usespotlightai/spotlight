import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import type { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import type { CheckVerdict } from '@outcomes/domain/value-objects/check-verdict';
import type { DeliveryState } from '@outcomes/domain/value-objects/delivery-state';
import type { RunEnding } from '@outcomes/domain/value-objects/run-ending';

export interface RunCostDto {
  readonly ms: number | null;
  readonly steps: number;
  readonly faults: number;
  readonly used: number | null;
  readonly cost: number | null;
  readonly currency: string | null;
}

export interface RunOutcomeDto {
  readonly runId: string;
  readonly taskId: string;
  readonly fingerprint: string | null;
  readonly endedAt: string;
  readonly ending: RunEnding;
  readonly failure: string | null;
  readonly round: number;
  readonly cost: RunCostDto | null;
  readonly checks: CheckVerdict | null;
  readonly next: { readonly act: string; readonly at: string } | null;
  readonly handedOn: { readonly to: string; readonly at: string } | null;
  readonly delivery: DeliveryState | null;
}

export const runOutcomeOf = (
  record: RunRecord,
  deliveries: readonly TaskDelivery[],
): RunOutcomeDto | null => {
  const end = record.end;
  const ending = record.ending;

  if (!end || !ending) {
    return null;
  }

  const cost = record.cost;

  return {
    runId: record.runId.value,
    taskId: end.place.taskId.value,
    fingerprint: end.fingerprint,
    endedAt: end.endedAt.toISOString(),
    ending,
    failure: end.failure,
    round: end.round,
    cost: cost
      ? {
          ms: cost.ms,
          steps: cost.steps,
          faults: cost.faults,
          used: cost.used,
          cost: cost.spend?.amount ?? null,
          currency: cost.spend?.currency ?? null,
        }
      : null,
    checks: record.checks,
    next: record.next
      ? { act: record.next.act, at: record.next.at.toISOString() }
      : null,
    handedOn: record.handedOn
      ? { to: record.handedOn.to, at: record.handedOn.at.toISOString() }
      : null,
    delivery:
      deliveries.find((each) => each.taskId.equals(end.place.taskId))?.state ??
      null,
  };
};
