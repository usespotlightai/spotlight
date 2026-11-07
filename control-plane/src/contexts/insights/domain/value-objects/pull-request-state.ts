export const PULL_REQUEST_STATES = ['open', 'merged', 'closed'] as const;

export type PullRequestState = (typeof PULL_REQUEST_STATES)[number];
