import type { TaskRunState } from '@work/domain/value-objects/task-run-state';

export const PROGRESSES = ['queued', 'in-progress', 'stopping'] as const;

export type Progress = (typeof PROGRESSES)[number];

export interface RunProgressReading {
  readonly progress: Progress | null;
  readonly resumable: boolean;
}

export const progressOfCurrentRun = (
  current: RunProgressReading | null,
  takenUp: boolean,
): Progress | null => {
  if (current === null) {
    return 'queued';
  }

  return takenUp && current.resumable ? 'queued' : current.progress;
};

export const progressOfTaskRun = (
  state: TaskRunState,
  current: RunProgressReading | null,
  takenUp: boolean,
): Progress | null =>
  state === 'superseded' ? null : progressOfCurrentRun(current, takenUp);
