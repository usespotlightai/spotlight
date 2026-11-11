export const REPLAY_STATES = [
  'queued',
  'running',
  'finished',
  'stopped',
  'ceiling-reached',
] as const;

export type ReplayState = (typeof REPLAY_STATES)[number];

export const DISPATCHING_REPLAY_STATES: readonly ReplayState[] = [
  'queued',
  'running',
];

export const REPLAY_END_STATES = [
  'finished',
  'stopped',
  'ceiling-reached',
  'deleted',
] as const;

export type ReplayEndState = (typeof REPLAY_END_STATES)[number];
