export const RUN_STATES = [
  'queued',
  'claimed',
  'waiting',
  'parked',
  'completed',
  'failed',
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
  'superseded',
] as const satisfies readonly RunState[];
