import type { TaskRunState } from '@work/domain/value-objects/task-run-state';

const COUNTED_STATES: readonly TaskRunState[] = ['completed', 'failed'];

export const runNumberAfter = (earlier: readonly TaskRunState[]): number =>
  1 + earlier.filter((state) => COUNTED_STATES.includes(state)).length;
