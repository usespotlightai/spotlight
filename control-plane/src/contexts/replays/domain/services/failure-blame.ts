import type { RunEnd } from '@replays/domain/value-objects/run-end.vo';
import {
  isRunFailureCode,
  type RunFailureCode,
} from '@shared-kernel/domain/value-objects/run-failure-code';

type Blame = 'candidate' | 'infrastructure';

export const FAILURE_BLAME: Readonly<Record<RunFailureCode, Blame>> = {
  exited: 'candidate',
  refused: 'candidate',
  unprepared: 'infrastructure',
  unprovisioned: 'infrastructure',
  'hooks-unanswered': 'infrastructure',
  'runner-lost': 'infrastructure',
  'timed-out': 'candidate',
  cancelled: 'infrastructure',
  superseded: 'infrastructure',
};

export const blamesTheCandidate = (end: RunEnd): boolean => {
  if (end.failure !== null && isRunFailureCode(end.failure)) {
    return FAILURE_BLAME[end.failure] === 'candidate';
  }

  return end.result !== 'exhausted';
};
