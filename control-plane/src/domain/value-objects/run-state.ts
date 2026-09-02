export const RUN_STATES = ['queued', 'claimed', 'completed', 'failed'] as const;

export type RunState = (typeof RUN_STATES)[number];

/** A run in one of these is over, and nothing about it will change again. */
export const TERMINAL_RUN_STATES = [
  'completed',
  'failed',
] as const satisfies readonly RunState[];
