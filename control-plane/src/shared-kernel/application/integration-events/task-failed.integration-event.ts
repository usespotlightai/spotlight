export const TASK_FAILED = 'work.task-failed.v1';

export type TaskFailedIntegrationEvent = {
  readonly kind: typeof TASK_FAILED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly stationId: string;
  readonly runId: string | null;
  readonly source: string;
  readonly code: string;
  readonly occurrences: number;
  readonly at: string;
};
