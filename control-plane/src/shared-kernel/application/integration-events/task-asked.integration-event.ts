export const TASK_ASKED = 'work.task-asked.v1';

export type TaskAskedIntegrationEvent = {
  readonly kind: typeof TASK_ASKED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly stationId: string;
  readonly at: string;
};
