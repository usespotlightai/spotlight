import type { PullRequestActivityKind } from '@github/domain/services/pull-request-activity-policy';

export interface ReportedGitHubActivity {
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

export const pullRequestActivityOf = (
  reported: ReportedGitHubActivity,
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
