export const TRIAL_STACK_COMPLETED = 'change-review.trial-stack-completed.v1';

export type TrialStackCompletedIntegrationEvent = {
  readonly kind: typeof TRIAL_STACK_COMPLETED;
  readonly runId: string;
  readonly workspaceId: string;
};
