export const REPLAY_STATES = [
  'queued',
  'running',
  'finished',
  'stopped',
  'over-budget',
] as const;

export type ReplayState = (typeof REPLAY_STATES)[number];

export const REPLAY_ENDS = [
  'finished',
  'stopped',
  'over-budget',
  'deleted',
] as const;

export type ReplayEnd = (typeof REPLAY_ENDS)[number];
