export const TRIAL_CHANGE_RECHECKED = 'change-review.trial-change-rechecked.v1';

export type TrialChangeRecheckedIntegrationEvent = {
  readonly kind: typeof TRIAL_CHANGE_RECHECKED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly passed: boolean | null;
};
