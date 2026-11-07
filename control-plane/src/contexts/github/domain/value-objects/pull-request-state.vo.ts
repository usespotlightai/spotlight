export const PULL_REQUEST_STATES = ['open', 'merged', 'closed'] as const;

export type PullRequestState = (typeof PULL_REQUEST_STATES)[number];

export interface ReportedPullRequestState {
  readonly state: string | null;
  readonly merged: boolean;
  readonly mergedAt: string | null;
}

export const pullRequestStateOf = (
  reported: ReportedPullRequestState,
): PullRequestState => {
  if (reported.merged || reported.mergedAt) {
    return 'merged';
  }

  return reported.state === 'closed' ? 'closed' : 'open';
};

export interface ReportedClosing {
  readonly mergedAt: Date | null;
  readonly closedAt: Date | null;
}

export const closedAtOf = (
  state: PullRequestState,
  reported: ReportedClosing,
): Date | null =>
  state === 'merged'
    ? (reported.mergedAt ?? reported.closedAt)
    : reported.closedAt;
