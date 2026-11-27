import type { ReactElement } from 'react';

import { TaskPullRequestStateIcon } from '@/components/features/board/task/TaskPullRequestStateIcon';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { DiffStat } from '@/components/shared/DiffStat';
import { nonEmpty } from '@/lib/non-empty';
import { pullRequestOf } from '@/lib/pull-request-link';
import {
  type PullRequestState,
  pullRequestStateName,
  type TaskPullRequest,
} from '@/lib/pull-request-state';
import { since } from '@/lib/since';
import { cn } from '@/lib/utils';

const BADGES: Record<PullRequestState, string> = {
  draft: 'bg-pull-request-draft/15 text-pull-request-draft',
  open: 'bg-pull-request-open/15 text-pull-request-open',
  merged: 'bg-pull-request-merged/15 text-pull-request-merged',
  closed: 'bg-pull-request-closed/15 text-pull-request-closed',
};

export function TaskPullRequestCard({
  pullRequest,
}: {
  pullRequest: TaskPullRequest;
}): ReactElement {
  const { repository, number } = pullRequestOf(pullRequest.url);
  const {
    state,
    title,
    author,
    authorImage,
    additions,
    deletions,
    changedFiles,
    updatedAt,
  } = pullRequest;
  const named = pullRequestStateName(state);

  return (
    <div data-slot="pull-request-card" className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        {nonEmpty(title) && (
          <p className="font-medium text-foreground text-sm leading-snug">
            {title}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          {repository} #{number}
        </p>
      </div>

      {(nonEmpty(author) || nonEmpty(updatedAt) || changedFiles !== null) && (
        <div className="flex items-center gap-2.5 whitespace-nowrap text-muted-foreground text-xs">
          {nonEmpty(author) && (
            <span className="flex min-w-0 items-center gap-1">
              <PersonAvatar
                person={{ name: author, image: authorImage }}
                className="data-[size=sm]:size-4"
              />
              <span className="truncate">{author}</span>
            </span>
          )}
          {nonEmpty(updatedAt) && (
            <span className="shrink-0">{since(updatedAt)}</span>
          )}
          {additions !== null && deletions !== null && (
            <DiffStat added={additions} removed={deletions} always />
          )}
          {changedFiles !== null && (
            <span className="shrink-0 tabular-nums">
              {changedFiles} {changedFiles === 1 ? 'file' : 'files'}
            </span>
          )}
        </div>
      )}

      {state && nonEmpty(named) && (
        <span
          className={cn(
            'flex h-5 w-fit items-center gap-1 rounded-full px-2 text-xs',
            BADGES[state],
          )}
        >
          <TaskPullRequestStateIcon
            state={state}
            className="size-3 text-current"
          />
          {named}
        </span>
      )}
    </div>
  );
}
