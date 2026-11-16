export const TASK_TAKEN_OVER = 'work.task-taken-over.v1';

export type TakeoverVerdictPublished = 'not-right' | 'exploring';

export type TaskTakenOverIntegrationEvent = {
  readonly kind: typeof TASK_TAKEN_OVER;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly takeoverId: string;
  readonly stationId: string;
  readonly by: string;
  readonly fromRunId: string | null;
  readonly verdict: TakeoverVerdictPublished;
  readonly at: string;
};
