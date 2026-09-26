export const TASK_MOVED = 'work.task-moved.v1';

export type TaskMovedIntegrationEvent = {
  readonly kind: typeof TASK_MOVED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly from: string;
  readonly to: string;
  readonly at: string;
};
