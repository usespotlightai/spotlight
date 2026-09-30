import type { RunState } from '@work/domain/value-objects/run-state';

const ROUND_STATES: readonly RunState[] = ['completed', 'failed'];

export const roundAfter = (earlier: readonly RunState[]): number =>
  1 + earlier.filter((state) => ROUND_STATES.includes(state)).length;
