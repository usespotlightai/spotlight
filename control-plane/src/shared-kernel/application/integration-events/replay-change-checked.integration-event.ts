export const REPLAY_CHANGE_CHECKED = 'change-review.replay-change-checked.v1';

export type ReplayChangeCheckedIntegrationEvent = {
  readonly kind: typeof REPLAY_CHANGE_CHECKED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly passed: boolean | null;
};
