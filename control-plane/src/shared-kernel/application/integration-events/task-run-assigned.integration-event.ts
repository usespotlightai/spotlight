export const TASK_RUN_ASSIGNED = 'work.task-run-assigned.v1';

export type TaskRunAssignedIntegrationEvent = {
  readonly kind: typeof TASK_RUN_ASSIGNED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly runId: string;
};
