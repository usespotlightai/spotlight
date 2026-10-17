export const TASK_DISPATCHED = 'work.task-dispatched.v1';

export type TaskDispatchedIntegrationEvent = {
  readonly kind: typeof TASK_DISPATCHED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly runId: string;
};
