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

export const RUN_ACTIVITIES = ['queued', 'working', 'stopping'] as const;

export type RunActivity = (typeof RUN_ACTIVITIES)[number];

export interface RunActivityFacts {
  readonly state: RunState;
  readonly stopRequested: boolean;
  readonly awaitsPerson: boolean;
  readonly current: boolean;
}

export const activityOf = ({
  state,
  stopRequested,
  awaitsPerson,
  current,
}: RunActivityFacts): RunActivity | null => {
  if (isStopping(state, stopRequested)) {
    return 'stopping';
  }
  if (awaitsPerson) {
    return null;
  }
  if (state === 'queued') {
    return 'queued';
  }
  if (state === 'claimed') {
    return 'working';
  }
  if (current && resumable(state, stopRequested)) {
    return state === 'waiting' ? 'working' : 'queued';
  }

  return null;
};
