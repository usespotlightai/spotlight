export const PULL_REQUEST_TYPES = [
  'feature',
  'fix',
  'refactor',
  'tests',
  'chore',
  'other',
] as const;

export type PullRequestType = (typeof PULL_REQUEST_TYPES)[number];
