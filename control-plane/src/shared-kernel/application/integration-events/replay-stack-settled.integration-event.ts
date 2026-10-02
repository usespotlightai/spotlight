export const REPLAY_STACK_SETTLED = 'change-review.replay-stack-settled.v1';

export type ReplayStackSettledIntegrationEvent = {
  readonly kind: typeof REPLAY_STACK_SETTLED;
  readonly runId: string;
  readonly workspaceId: string;
};
