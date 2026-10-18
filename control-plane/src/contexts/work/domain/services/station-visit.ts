import type { RunState } from '@work/domain/value-objects/run-state';

const VISIT_STATES: readonly RunState[] = ['completed', 'failed'];

export const visitAfter = (earlier: readonly RunState[]): number =>
  1 + earlier.filter((state) => VISIT_STATES.includes(state)).length;
