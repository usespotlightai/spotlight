export const TASK_RUN_STATES = [
  'queued',
  'claimed',
  'suspended',
  'completed',
  'failed',
  'cancelled',
  'superseded',
] as const;

export type TaskRunState = (typeof TASK_RUN_STATES)[number];

export const taskRunStateOf = (
  state: Exclude<TaskRunState, 'superseded'>,
  superseded: boolean,
): TaskRunState => (superseded ? 'superseded' : state);
