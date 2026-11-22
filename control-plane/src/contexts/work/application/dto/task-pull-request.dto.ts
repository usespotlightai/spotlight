export const TASK_PULL_REQUEST_STATE_NAMES = [
  'draft',
  'open',
  'merged',
  'closed',
] as const;

export type TaskPullRequestState =
  (typeof TASK_PULL_REQUEST_STATE_NAMES)[number];

export interface TaskPullRequestSummary {
  readonly state: TaskPullRequestState;
  readonly title: string;
  readonly author: string | null;
  readonly additions: number | null;
  readonly deletions: number | null;
  readonly changedFiles: number | null;
  readonly updatedAt: Date;
}

export interface TaskPullRequestDto {
  readonly url: string;
  readonly summary: TaskPullRequestSummary | null;
}
