export const RUN_STATES = ['queued', 'claimed', 'completed', 'failed'] as const;

export type RunState = (typeof RUN_STATES)[number];
