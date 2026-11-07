export const REPLAY_RUN_DECISIONS = [
  'queued',
  'cancelled',
  'unreplayable',
] as const;

export type ReplayRunDecided = (typeof REPLAY_RUN_DECISIONS)[number];
