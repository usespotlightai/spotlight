import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
/** How many decisions one call may record, and how many a task keeps in all. */
export const DECISION_LIMITS = { atOnce: 20, perTask: 50 } as const;

export interface DecidedTask {
  readonly reviewing: boolean;
}

export interface DecidingRun {
  readonly taskId: TaskId | null;
  readonly trial: boolean;
  /** Whether the station of the run keeps decisions. */
  readonly decisions: boolean;
}

const DECISION_REFUSALS = [
  'works-no-task',
  'station-keeps-none',
  'reviews-pull-request',
  'task-merged',
  'task-full',
] as const;

export type DecisionRefusal = (typeof DECISION_REFUSALS)[number];

export const keepsDecisions = (task: DecidedTask): boolean => !task.reviewing;

/**
 * Why the run may not record decisions, or null when it may. Only a run of a task of its own, on a station that keeps
 * decisions, records them, and a task that reviews a pull request keeps none. `task` is null only when the run works
 * no task.
 */
export const mayRecordDecisions = (
  run: DecidingRun,
  task: DecidedTask | null,
): DecisionRefusal | null => {
  if (!run.taskId || run.trial || !task) {
    return 'works-no-task';
  }

  if (!run.decisions) {
    return 'station-keeps-none';
  }

  return keepsDecisions(task) ? null : 'reviews-pull-request';
};
