import type { ReactElement } from 'react';

import { TaskPullRequestCard } from '@/components/features/board/task/TaskPullRequestCard';
import { TaskPullRequestStateIcon } from '@/components/features/board/task/TaskPullRequestStateIcon';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { nonEmpty } from '@/lib/non-empty';
import { pillClass } from '@/lib/pill';
import { pullRequestOf } from '@/lib/pull-request-link';
import {
  pullRequestStateName,
  type TaskPullRequest,
} from '@/lib/pull-request-state';

export function TaskPullRequestPill({
  pullRequest,
}: {
  pullRequest: TaskPullRequest;
}): ReactElement {
  const { repository, number } = pullRequestOf(pullRequest.url);
  const { state } = pullRequest;
  const named = pullRequestStateName(state);

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={100}
        href={pullRequest.url}
        target="_blank"
        rel="noreferrer"
        data-slot="pull-request-pill"
        data-state={state ?? undefined}
        aria-label={`Pull request ${number} in ${repository}${nonEmpty(named) ? `, ${named.toLowerCase()}` : ''}`}
        className={pillClass(
          'outline',
          'max-w-64 gap-1.5 px-2.5 font-normal text-sm',
          'regular',
        )}
      >
        <TaskPullRequestStateIcon state={state} />
        <span className="truncate">#{number}</span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 p-3">
        <TaskPullRequestCard pullRequest={pullRequest} />
      </HoverCardContent>
    </HoverCard>
  );
}
