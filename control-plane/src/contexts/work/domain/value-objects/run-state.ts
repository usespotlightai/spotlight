export const RUN_STATES = [
  'queued',
  'claimed',
  'waiting',
  'suspended',
  'completed',
  'failed',
  'cancelled',
  'superseded',
] as const;

export type RunState = (typeof RUN_STATES)[number];

export const LEASED_RUN_STATES = [
  'claimed',
  'waiting',
] as const satisfies readonly RunState[];

export const TERMINAL_RUN_STATES = [
  'completed',
  'failed',
  'cancelled',
  'superseded',
] as const satisfies readonly RunState[];

export const isStopping = (state: RunState, stopRequested: boolean): boolean =>
  stopRequested &&
  !(TERMINAL_RUN_STATES as readonly RunState[]).includes(state);

export const PROGRESSES = ['queued', 'in-progress'] as const;

export type Progress = (typeof PROGRESSES)[number];

interface Working {
  readonly state: RunState;
  readonly stopRequested: boolean;
}

export const progressOf = (run: Working): Progress | null => {
  if (isStopping(run.state, run.stopRequested)) {
    return null;
  }

  if (run.state === 'queued') {
    return 'queued';
  }

  return run.state === 'claimed' ? 'in-progress' : null;
};

export const progressOfCurrentRun = (
  current: Working | null,
): Progress | null => (current === null ? 'queued' : progressOf(current));
