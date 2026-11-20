export const TASK_PULL_REQUEST_STATE_NAMES = [
  'draft',
  'open',
  'merged',
  'closed',
] as const;

export type TaskPullRequestState =
  (typeof TASK_PULL_REQUEST_STATE_NAMES)[number];

export interface TaskPullRequestDto {
  readonly url: string;
  readonly state: TaskPullRequestState | null;
}
