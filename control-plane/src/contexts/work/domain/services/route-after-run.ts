import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import type { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';

export type RunRouting =
  | { readonly kind: 'finish'; readonly line: Line }
  | { readonly kind: 'ask'; readonly failure: TaskFailure | null }
  | { readonly kind: 'detach'; readonly failure: TaskFailure | null }
  | {
      readonly kind: 'advance';
      readonly to: Station;
      readonly line: Line;
    }
  | {
      readonly kind: 'deferredMove';
      readonly to: Station;
      readonly line: Line;
    };

export const putsItToAPerson = (routing: RunRouting): boolean =>
  routing.kind === 'ask' && routing.failure === null;

const failureOf = (handover: ResolvedHandover): TaskFailure | null =>
  handover.kind === 'review' ? handover.failure : null;

export const routeAfterRun = (
  handover: ResolvedHandover,
  line: Line | null,
  task: Pick<Task, 'awaitingReview' | 'deferredMoveTo'>,
): RunRouting => {
  const passedTo =
    handover.kind === 'pass' && !task.awaitingReview
      ? line?.stationAt(handover.stationId)
      : null;

  if (passedTo && line) {
    return { kind: 'advance', to: passedTo, line };
  }

  const deferredTo = task.deferredMoveTo
    ? line?.stationAt(task.deferredMoveTo)
    : null;

  if (deferredTo && line) {
    return { kind: 'deferredMove', to: deferredTo, line };
  }

  if (task.awaitingReview) {
    return { kind: 'detach', failure: failureOf(handover) };
  }

  if (handover.kind === 'done' && line) {
    return { kind: 'finish', line };
  }

  return { kind: 'ask', failure: failureOf(handover) };
};
