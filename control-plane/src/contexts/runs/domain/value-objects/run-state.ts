import type { RunTurnState } from '@runs/domain/value-objects/run-turn.vo';

export const RUN_STATES = [
  'queued',
  'claimed',
  'suspended',
  'completed',
  'failed',
  'cancelled',
] as const;

export type RunState = (typeof RUN_STATES)[number];

export const LEASED_RUN_STATES = [
  'claimed',
] as const satisfies readonly RunState[];

export const isLeasedState = (state: RunState): boolean =>
  (LEASED_RUN_STATES as readonly RunState[]).includes(state);

export const TERMINAL_RUN_STATES = [
  'completed',
  'failed',
  'cancelled',
] as const satisfies readonly RunState[];

export const OPEN_RUN_STATES = RUN_STATES.filter(
  (state): state is Exclude<RunState, (typeof TERMINAL_RUN_STATES)[number]> =>
    !(TERMINAL_RUN_STATES as readonly RunState[]).includes(state),
);

export const isStopping = (state: RunState, stopRequested: boolean): boolean =>
  stopRequested &&
  !(TERMINAL_RUN_STATES as readonly RunState[]).includes(state);

export const resumable = (
  state: RunState,
  stopRequested: boolean,
  turn: RunTurnState | null = null,
): boolean => state === 'suspended' && !stopRequested && turn !== 'pending';

export const PROGRESSES = ['queued', 'in-progress', 'stopping'] as const;

export type Progress = (typeof PROGRESSES)[number];

interface Working {
  readonly state: RunState;
  readonly stopRequested: boolean;
  readonly turn?: RunTurnState | null;
}

export const progressOf = (run: Working): Progress | null => {
  if (isStopping(run.state, run.stopRequested)) {
    return 'stopping';
  }

  if (run.state === 'queued') {
    return 'queued';
  }

  return run.state === 'claimed' ||
    (run.state === 'suspended' && run.turn === 'pending')
    ? 'in-progress'
    : null;
};
