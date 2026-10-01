export const TASK_OPENED = 'work.task-opened.v1';

export type TaskOpenedIntegrationEvent = {
  readonly kind: typeof TASK_OPENED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly by: string | null;
  readonly at: string;
};
