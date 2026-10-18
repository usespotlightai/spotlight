export const TASK_PASSED = 'work.task-passed.v1';

export type TaskPassedIntegrationEvent = {
  readonly kind: typeof TASK_PASSED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly from: string;
  readonly to: string;
  readonly at: string;
};
