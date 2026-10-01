export const TASK_HANDED_ON = 'work.task-handed-on.v1';

export type TaskHandedOnIntegrationEvent = {
  readonly kind: typeof TASK_HANDED_ON;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly from: string;
  readonly to: string;
  readonly at: string;
};
