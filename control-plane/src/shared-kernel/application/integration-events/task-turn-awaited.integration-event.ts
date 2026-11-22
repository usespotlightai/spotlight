export const TASK_TURN_AWAITED = 'work.task-turn-awaited.v1';

export type TaskTurnAwaitedIntegrationEvent = {
  readonly kind: typeof TASK_TURN_AWAITED;
  readonly taskId: string;
  readonly workspaceId: string;
  readonly runId: string;
  readonly attempt: number;
  readonly handsOver: boolean;
};
