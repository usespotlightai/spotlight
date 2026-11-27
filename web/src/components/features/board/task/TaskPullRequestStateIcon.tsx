import {
  GitMerge,
  GitPullRequest,
  GitPullRequestClosed,
  GitPullRequestDraft,
  type LucideIcon,
} from 'lucide-react';
import type { ReactElement } from 'react';

import type { PullRequestState } from '@/lib/pull-request-state';
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

export function TaskPullRequestStateIcon({
  state,
  className,
}: {
  state: PullRequestState | null;
  className?: string;
}): ReactElement {
  const Icon = state ? ICONS[state] : GitPullRequest;

  return (
    <Icon
      aria-hidden
      className={cn(
        'size-3.5 shrink-0',
        state ? COLORS[state] : 'text-muted-foreground',
        className,
      )}
    />
  );
}
