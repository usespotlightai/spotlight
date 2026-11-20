import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  type LucideIcon,
} from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { pillClass } from '@/lib/pill';
import { pullRequestOf } from '@/lib/pull-request-link';
import {
  type PullRequestState,
  pullRequestStateName,
  type TaskPullRequest,
} from '@/lib/pull-request-state';
import { cn } from '@/lib/utils';

const ICONS: Record<PullRequestState, LucideIcon> = {
  draft: GitPullRequestDraft,
  open: GitPullRequest,
  merged: GitMerge,
  closed: GitPullRequestClosed,
};

const COLORS: Record<PullRequestState, string> = {
  draft: 'text-pull-request-draft',
  open: 'text-pull-request-open',
  merged: 'text-pull-request-merged',
  closed: 'text-pull-request-closed',
};

export function TaskPullRequestPill({
  pullRequest,
}: {
  pullRequest: TaskPullRequest;
}) {
  const { repository, number } = pullRequestOf(pullRequest.url);
  const { state } = pullRequest;
  const named = pullRequestStateName(state);
  const Icon = state ? ICONS[state] : GitPullRequest;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <a
            href={pullRequest.url}
            target="_blank"
            rel="noreferrer"
            data-slot="pull-request-pill"
            data-state={state ?? undefined}
            aria-label={`Pull request ${number} in ${repository}${named ? `, ${named.toLowerCase()}` : ''}`}
            className={pillClass(
              'outline',
              'max-w-64 gap-1.5 px-2.5 font-normal text-sm',
              'regular',
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                'size-3.5 shrink-0',
                state ? COLORS[state] : 'text-muted-foreground',
              )}
            />
            <span className="truncate">#{number}</span>
          </a>
        }
      />
      <TooltipContent side="top" align="center">
        <span className="flex flex-col">
          <span>{repository}</span>
          {named && <span className="text-muted-foreground">{named}</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
