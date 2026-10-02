export const REPLAY_STATES = [
  'queued',
  'running',
  'finished',
  'stopped',
  'over-budget',
] as const;

export type ReplayState = (typeof REPLAY_STATES)[number];
