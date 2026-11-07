import type { TaskRunState } from '@work/domain/value-objects/task-run-state';

const VISIT_STATES: readonly TaskRunState[] = ['completed', 'failed'];

export const visitAfter = (earlier: readonly TaskRunState[]): number =>
  1 + earlier.filter((state) => VISIT_STATES.includes(state)).length;
