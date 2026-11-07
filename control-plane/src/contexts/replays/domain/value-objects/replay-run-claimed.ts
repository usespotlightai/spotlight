export const REPLAY_RUN_CLAIMS = [
  'queued',
  'cancelled',
  'unreplayable',
] as const;

export type ClaimedAs = (typeof REPLAY_RUN_CLAIMS)[number];
