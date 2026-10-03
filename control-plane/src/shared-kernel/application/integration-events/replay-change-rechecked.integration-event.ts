export const REPLAY_CHANGE_RECHECKED =
  'change-review.replay-change-rechecked.v1';

export type ReplayChangeRecheckedIntegrationEvent = {
  readonly kind: typeof REPLAY_CHANGE_RECHECKED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly passed: boolean | null;
};
