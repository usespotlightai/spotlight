import { GitPullRequest } from 'lucide-react';
import type { ReactElement } from 'react';

import { pullRequestOf } from '@/lib/pull-request-link';

type TaskPullRequestLinkProps = {
  href: string;
  named: boolean;
};

export function TaskPullRequestLink({
  href,
  named,
}: TaskPullRequestLinkProps): ReactElement {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none transition-colors hover:bg-accent"
    >
      <GitPullRequest
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />

      <span className="truncate text-foreground">
        {named
          ? `Pull request in ${pullRequestOf(href).repository}`
          : 'Pull request'}
      </span>
    </a>
  );
}
