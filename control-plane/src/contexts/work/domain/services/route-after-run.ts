import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { ResolvedHandover } from '@work/domain/value-objects/resolved-handover.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import type { TaskFailure } from '@work/domain/value-objects/task-failure.vo';

export type RunRouting =
  | { readonly kind: 'finish'; readonly line: LineMap }
  | {
      readonly kind: 'ask';
      readonly failure: TaskFailure | null;
      readonly runAsked: boolean;
    }
  | { readonly kind: 'detach'; readonly failure: TaskFailure | null }
  | {
      readonly kind: 'advance';
      readonly to: Station;
      readonly line: LineMap;
    }
  | {
      readonly kind: 'deferredMove';
      readonly to: Station;
      readonly line: LineMap;
    };

export const putsItToAPerson = (routing: RunRouting): boolean =>
  routing.kind === 'ask' && routing.failure === null;

const failureOf = (handover: ResolvedHandover): TaskFailure | null =>
  handover.kind === 'review' ? handover.failure : null;

const askOf = (handover: ResolvedHandover): RunRouting => ({
  kind: 'ask',
  failure: failureOf(handover),
  runAsked: handover.kind === 'review' && handover.asked,
});

export const routeAfterRun = (
  handover: ResolvedHandover,
  line: LineMap | null,
  task: Pick<Task, 'awaitingReview' | 'deferredMoveTo' | 'onHold'>,
): RunRouting => {
  if (task.onHold) {
    return task.awaitingReview
      ? { kind: 'detach', failure: failureOf(handover) }
      : askOf(handover);
  }

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

  return askOf(handover);
};
