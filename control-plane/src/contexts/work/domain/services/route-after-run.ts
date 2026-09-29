import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
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
    }
  | {
      readonly kind: 'heldBack';
      readonly to: Station;
      readonly line: Line;
    };

const failureOf = (handover: Handover): TaskFailure | null =>
  handover.kind === 'review' ? handover.failure : null;

export const routeAfterRun = (
  handover: Handover,
  line: Line | null,
  task: Pick<Task, 'awaitingReview' | 'heldBackTo'>,
): RunRouting => {
  const passedTo =
    handover.kind === 'pass' && !task.awaitingReview
      ? line?.stationAt(handover.stationId)
      : null;

  if (passedTo && line) {
    return { kind: 'advance', to: passedTo, line };
  }

  const heldBack = task.heldBackTo ? line?.stationAt(task.heldBackTo) : null;

  if (heldBack && line) {
    return { kind: 'heldBack', to: heldBack, line };
  }

  if (task.awaitingReview) {
    return { kind: 'let-go', failure: failureOf(handover) };
  }

  if (handover.kind === 'done' && line) {
    return { kind: 'finish', line };
  }

  return { kind: 'ask', failure: failureOf(handover) };
};
