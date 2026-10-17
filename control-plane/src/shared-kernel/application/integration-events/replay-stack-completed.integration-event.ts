export const REPLAY_STACK_COMPLETED = 'change-review.replay-stack-completed.v1';

export type ReplayStackCompletedIntegrationEvent = {
  readonly kind: typeof REPLAY_STACK_COMPLETED;
  readonly runId: string;
  readonly workspaceId: string;
};
