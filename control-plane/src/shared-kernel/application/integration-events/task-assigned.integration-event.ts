export const TASK_ASSIGNED = 'work.task-assigned.v1';

export type TaskAssignedIntegrationEvent = {
  readonly kind: typeof TASK_ASSIGNED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly assignee: string | null;
};
