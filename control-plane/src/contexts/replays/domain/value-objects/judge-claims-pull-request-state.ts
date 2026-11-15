export const JUDGE_CLAIMS_PULL_REQUEST_STATES = [
  'opening',
  'opened',
  'failed',
] as const;

export type JudgeClaimsPullRequestState =
  (typeof JUDGE_CLAIMS_PULL_REQUEST_STATES)[number];
