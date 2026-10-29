const REPLAY_ENDINGS = [
  'completed',
  'failed',
  'stopped',
  'asked',
  'unreplayable',
  'not-run',
] as const;

export type ReplayEnding = (typeof REPLAY_ENDINGS)[number];

export const RUN_RESULTS = [
  'completed',
  'failed',
  'exhausted',
  'cancelled',
] as const;

export type RunResult = (typeof RUN_RESULTS)[number];
