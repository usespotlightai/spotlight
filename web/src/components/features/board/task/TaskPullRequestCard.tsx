import { TaskPullRequestStateIcon } from '@/components/features/board/task/TaskPullRequestStateIcon';
import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { DiffStat } from '@/components/shared/DiffStat';
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

const pictureOf = (login: string): string =>
  `https://github.com/${encodeURIComponent(login)}.png?size=64`;

export function TaskPullRequestCard({
  pullRequest,
}: {
  pullRequest: TaskPullRequest;
}) {
  const { repository, number } = pullRequestOf(pullRequest.url);
  const {
    state,
    title,
    author,
    additions,
    deletions,
    changedFiles,
    updatedAt,
  } = pullRequest;
  const named = pullRequestStateName(state);

  return (
    <div data-slot="pull-request-card" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        {title && (
          <p className="font-medium text-base text-foreground leading-snug">
            {title}
          </p>
        )}
        <p className="text-muted-foreground text-sm">
          {repository} #{number}
        </p>
      </div>

      {(author || updatedAt || changedFiles !== null) && (
        <div className="flex items-center gap-3 whitespace-nowrap text-muted-foreground text-sm">
          {author && (
            <span className="flex min-w-0 items-center gap-1.5">
              <PersonAvatar
                person={{ name: author, image: pictureOf(author) }}
              />
              <span className="truncate">{author}</span>
            </span>
          )}
          {updatedAt && <span className="shrink-0">{since(updatedAt)}</span>}
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

      {state && named && (
        <span
          className={cn(
            'flex h-7 w-fit items-center gap-1.5 rounded-full px-3 text-sm',
            BADGES[state],
          )}
        >
          <TaskPullRequestStateIcon state={state} className="text-current" />
          {named}
        </span>
      )}
    </div>
  );
}
