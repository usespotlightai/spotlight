export const TASK_ACTED_ON = 'work.task-acted-on.v1';

export type TaskActedOnIntegrationEvent = {
  readonly kind: typeof TASK_ACTED_ON;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly stationId: string;
  readonly action: string;
  readonly by: string;
  readonly after: string | null;
  readonly at: string;
  readonly tool: string | null;
  readonly server: string | null;
};
