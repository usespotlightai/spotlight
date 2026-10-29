export const TASK_RESULTS = [
  'succeeded',
  'failed',
  'mixed',
  'unscored',
  'pending',
  'absent',
] as const;

export type TaskResult = (typeof TASK_RESULTS)[number];

export interface TaskSide {
  readonly result: TaskResult;
  readonly successRate: number | null;
  readonly reason: string;
}

export interface TaskRow {
  readonly taskId: string;
  readonly originalRunId: string;
  readonly title: string | null;
  readonly regressed: boolean;
  readonly live: TaskSide;
  readonly candidate: TaskSide;
}
