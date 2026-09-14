import { GitPullRequest } from 'lucide-react';
import type { ReactNode } from 'react';

type ProposedPullRequestProps = {
  url: string;
  children: ReactNode;
};

export function ProposedPullRequest({
  url,
  children,
}: ProposedPullRequestProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border-[0.5px] border-border bg-card px-3 py-2 text-sm outline-none transition-colors hover:bg-accent"
    >
      <GitPullRequest
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <span className="text-foreground">{children}</span>
    </a>
  );
}
