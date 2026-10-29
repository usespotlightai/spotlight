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

export const REPLAY_STOP_REASONS = [
  'finished',
  'stopped',
  'ceiling-reached',
  'deleted',
] as const;

export type ReplayStopReason = (typeof REPLAY_STOP_REASONS)[number];
