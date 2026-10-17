export const CHANGE_STACK_READY = 'change-review.change-stack-ready.v1';

export type ChangeStackReadyIntegrationEvent = {
  readonly kind: typeof CHANGE_STACK_READY;
  readonly runId: string;
  readonly taskId: string | null;
  readonly workspaceId: string;
  readonly changeTitles: readonly string[];
  readonly changeIntents: readonly string[];
  readonly at: string;
};
