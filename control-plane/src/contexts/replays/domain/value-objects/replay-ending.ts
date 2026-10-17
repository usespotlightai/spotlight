export const REPLAY_ENDINGS = [
  'completed',
  'failed',
  'stopped',
  'asked',
  'unreplayable',
  'not-run',
] as const;

export type ReplayEnding = (typeof REPLAY_ENDINGS)[number];

export const RUN_OUTCOMES = [
  'completed',
  'failed',
  'exhausted',
  'cancelled',
] as const;

export type RunOutcome = (typeof RUN_OUTCOMES)[number];
