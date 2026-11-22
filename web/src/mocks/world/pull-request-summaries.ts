import type { TaskResponseDto } from '@/lib/api';
import type {
  PullRequestState,
  TaskPullRequest,
} from '@/lib/pull-request-state';
import { PULL_88, PULL_412 } from '@/mocks/world/work-stories';

const HOUR = 3_600_000;

const STATES: Readonly<Record<string, PullRequestState>> = {
  [PULL_412]: 'draft',
  [PULL_88]: 'merged',
};

const sizeOf = (url: string): number =>
  Array.from(url).reduce((sum, each) => sum + each.charCodeAt(0), 0);

export const pullRequestSummaryOf = (
  url: string,
  task: Pick<TaskResponseDto, 'title' | 'finished'>,
): TaskPullRequest => {
  const size = sizeOf(url);

  return {
    url,
    state: STATES[url] ?? (task.finished ? 'merged' : 'open'),
    title: task.title,
    author: 'spotlight-agent[bot]',
    authorImage: null,
    additions: 40 + (size % 400),
    deletions: 5 + (size % 90),
    changedFiles: 2 + (size % 14),
    updatedAt: new Date(Date.now() - (2 + (size % 30)) * HOUR).toISOString(),
  };
};
