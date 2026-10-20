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

export const WORKS = ['queued', 'in-progress'] as const;

export type Work = (typeof WORKS)[number];

export const workOfCurrentRun = (
  current: { readonly state: RunState } | null,
): Work | null => {
  if (current === null || current.state === 'queued') {
    return 'queued';
  }

  return current.state === 'claimed' ? 'in-progress' : null;
};
