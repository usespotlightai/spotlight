export const TASK_PULL_REQUEST_STATES = ['open', 'merged', 'closed'] as const;

export type TaskPullRequestState = (typeof TASK_PULL_REQUEST_STATES)[number];
