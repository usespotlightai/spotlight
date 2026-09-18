export const RUN_STATES = ['queued', 'claimed', 'completed', 'failed'] as const;

export type RunState = (typeof RUN_STATES)[number];

export const TERMINAL_RUN_STATES = [
  'completed',
  'failed',
] as const satisfies readonly RunState[];
