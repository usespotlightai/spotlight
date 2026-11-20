import type { TaskPullRequestResponseDto } from '@/lib/api';

export type TaskPullRequest = TaskPullRequestResponseDto;

export type PullRequestState = NonNullable<TaskPullRequest['state']>;

const NAMES: Record<PullRequestState, string> = {
  draft: 'Draft',
  open: 'Open',
  merged: 'Merged',
  closed: 'Closed',
};

export const pullRequestStateName = (
  state: TaskPullRequest['state'],
): string | null => (state ? NAMES[state] : null);
