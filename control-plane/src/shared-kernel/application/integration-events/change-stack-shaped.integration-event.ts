export const CHANGE_STACK_SHAPED = 'change-review.change-stack-shaped.v1';

export type ChangeStackShapedIntegrationEvent = {
  readonly kind: typeof CHANGE_STACK_SHAPED;
  readonly runId: string;
  readonly taskId: string | null;
  readonly workspaceId: string;
  readonly changeTitles: readonly string[];
  readonly changeIntents: readonly string[];
  readonly at: string;
};
