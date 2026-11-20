import { TaskPullRequestPill } from '@/components/features/board/task/TaskPullRequestPill';
import type { TaskPullRequest } from '@/lib/pull-request-state';

export function TaskPullRequestPills({
  pullRequests,
}: {
  pullRequests: readonly TaskPullRequest[];
}) {
  return pullRequests.map((pullRequest) => (
    <TaskPullRequestPill key={pullRequest.url} pullRequest={pullRequest} />
  ));
}
