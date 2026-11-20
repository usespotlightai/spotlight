import type { PullRequestState } from '@/lib/pull-request-state';
import { PULL_88, PULL_412 } from '@/mocks/world/work-stories';

const STATES: Readonly<Record<string, PullRequestState>> = {
  [PULL_412]: 'draft',
  [PULL_88]: 'merged',
};

export const pullRequestStateOf = (
  url: string,
  finished: boolean,
): PullRequestState => STATES[url] ?? (finished ? 'merged' : 'open');
