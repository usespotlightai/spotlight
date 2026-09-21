export const TASK_HANDED_TO_RUN = 'work.task-handed-to-run.v1';

export type TaskHandedToRunIntegrationEvent = {
  readonly kind: typeof TASK_HANDED_TO_RUN;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly runId: string;
};
