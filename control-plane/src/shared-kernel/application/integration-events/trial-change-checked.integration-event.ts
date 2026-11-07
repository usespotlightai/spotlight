export const TRIAL_CHANGE_CHECKED = 'change-review.trial-change-checked.v1';

export type TrialChangeCheckedIntegrationEvent = {
  readonly kind: typeof TRIAL_CHANGE_CHECKED;
  readonly runId: string;
  readonly workspaceId: string;
  readonly passed: boolean | null;
};
