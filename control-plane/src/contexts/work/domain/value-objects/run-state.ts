export const RUN_STATES = [
  'queued',
  'claimed',
  'completed',
  'failed',
  'superseded',
] as const;

export type RunState = (typeof RUN_STATES)[number];

export const TERMINAL_RUN_STATES = [
  'completed',
  'failed',
  'superseded',
] as const satisfies readonly RunState[];
