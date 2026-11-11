export type PullRequestActivityKind =
  | 'opened'
  | 'labelled'
  | 'merged'
  | 'closed-unmerged'
  | 'commented'
  | 'changes-requested'
  | 'checks-failed';

const FROM_ANY_SENDER: readonly PullRequestActivityKind[] = [
  'opened',
  'labelled',
  'checks-failed',
];

export const ignoredAsBot = (
  activity: PullRequestActivityKind,
  sentByBot: boolean,
): boolean => sentByBot && !FROM_ANY_SENDER.includes(activity);
