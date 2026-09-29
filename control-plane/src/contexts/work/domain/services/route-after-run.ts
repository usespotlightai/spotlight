import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import type { Handover } from '@work/domain/value-objects/handover.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';

export type RunRouting =
  | { readonly kind: 'finish'; readonly line: Line }
  | { readonly kind: 'ask'; readonly failure: TaskFailure | null }
  | { readonly kind: 'let-go'; readonly failure: TaskFailure | null }
  | {
      readonly kind: 'advance';
      readonly to: Station;
      readonly line: Line;
    };

const failureOf = (handover: Handover): TaskFailure | null =>
  handover.kind === 'review' ? handover.failure : null;

export const routeAfterRun = (
  handover: Handover,
  line: Line | null,
  awaitingAPerson = false,
): RunRouting => {
  if (awaitingAPerson) {
    return { kind: 'let-go', failure: failureOf(handover) };
  }

  if (handover.kind === 'done' && line) {
    return { kind: 'finish', line };
  }

  if (handover.kind === 'review') {
    return { kind: 'ask', failure: handover.failure };
  }

  const to =
    handover.kind === 'pass' ? line?.stationAt(handover.stationId) : null;

  return to && line
    ? { kind: 'advance', to, line }
    : { kind: 'ask', failure: null };
};
