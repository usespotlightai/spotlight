export const CHANGE_CHECKED = 'change-review.change-checked.v1';

export type ChangeCheckedIntegrationEvent = {
  readonly kind: typeof CHANGE_CHECKED;
  readonly runId: string;
  readonly taskId: string | null;
  readonly workspaceId: string;
  readonly repository: string | null;
  readonly stackStartedAt: string;
  readonly passed: boolean | null;
  readonly at: string;
};
