export type PullRequestActivityKind =
  | 'opened'
  | 'labelled'
  | 'merged'
  | 'closed-unmerged'
  | 'commented'
  | 'changes-requested'
  | 'checks-failed';

export interface ReportedActivity {
  readonly event: string | null;
  readonly action: string | null;
  readonly merged: boolean;
  readonly reviewState: string | null;
  readonly checkConclusion: string | null;
}

const OPENING_ACTIONS: readonly (string | null)[] = [
  'opened',
  'reopened',
  'ready_for_review',
];

const FROM_ANY_SENDER: readonly PullRequestActivityKind[] = [
  'opened',
  'labelled',
  'checks-failed',
];

export const pullRequestActivityOf = (
  reported: ReportedActivity,
): PullRequestActivityKind | null => {
  const { event, action } = reported;

  if (event === 'pull_request' && OPENING_ACTIONS.includes(action)) {
    return 'opened';
  }

  if (event === 'pull_request' && action === 'labeled') {
    return 'labelled';
  }

  if (event === 'pull_request' && action === 'closed') {
    return reported.merged ? 'merged' : 'closed-unmerged';
  }

  if (event === 'pull_request_review') {
    return reported.reviewState === 'changes_requested'
      ? 'changes-requested'
      : action === 'submitted'
        ? 'commented'
        : null;
  }

  if (
    (event === 'issue_comment' || event === 'pull_request_review_comment') &&
    action === 'created'
  ) {
    return 'commented';
  }

  if (event === 'check_suite' && action === 'completed') {
    return reported.checkConclusion === 'failure' ? 'checks-failed' : null;
  }

  return null;
};

export const ignoredAsBot = (
  activity: PullRequestActivityKind,
  sentByBot: boolean,
): boolean => sentByBot && !FROM_ANY_SENDER.includes(activity);
