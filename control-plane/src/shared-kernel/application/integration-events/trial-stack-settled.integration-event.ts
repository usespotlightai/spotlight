export const TRIAL_STACK_SETTLED = 'change-review.trial-stack-settled.v1';

export type TrialStackSettledIntegrationEvent = {
  readonly kind: typeof TRIAL_STACK_SETTLED;
  readonly runId: string;
  readonly workspaceId: string;
};
