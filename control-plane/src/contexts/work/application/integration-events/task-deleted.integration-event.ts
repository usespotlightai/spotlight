export const TASK_DELETED = 'work.task-deleted.v1';

export type TaskDeletedIntegrationEvent = {
  readonly kind: typeof TASK_DELETED;
  readonly taskId: string;
  readonly workspaceId: string;
};
