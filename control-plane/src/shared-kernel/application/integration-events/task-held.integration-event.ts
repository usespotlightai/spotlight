export const TASK_HELD = 'work.task-held.v1';

export type TaskHeldIntegrationEvent = {
  readonly kind: typeof TASK_HELD;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly holdId: string;
  readonly stationId: string;
  readonly by: string;
  readonly fromRunId: string | null;
  readonly at: string;
};
