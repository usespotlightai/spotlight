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

export const resumable = (state: RunState, stopRequested: boolean): boolean =>
  state === 'suspended' || (state === 'waiting' && !stopRequested);

export const PROGRESSES = ['queued', 'in-progress', 'stopping'] as const;

export type Progress = (typeof PROGRESSES)[number];

interface Working {
  readonly state: RunState;
  readonly stopRequested: boolean;
}

export const progressOf = (run: Working): Progress | null => {
  if (isStopping(run.state, run.stopRequested)) {
    return 'stopping';
  }

  if (run.state === 'queued') {
    return 'queued';
  }

  return run.state === 'claimed' ? 'in-progress' : null;
};

export const takenUpOnAnswer = (
  runId: string,
  task: {
    readonly currentRunId: string | null;
    readonly awaitsPerson: boolean;
  },
): boolean => runId === task.currentRunId && !task.awaitsPerson;

export const progressOfCurrentRun = (
  current: Working | null,
  takenUp: boolean,
): Progress | null => {
  if (current === null) {
    return 'queued';
  }
  if (takenUp && resumable(current.state, current.stopRequested)) {
    return current.state === 'waiting' ? 'in-progress' : 'queued';
  }

  return progressOf(current);
};
