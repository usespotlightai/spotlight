import { GitPullRequest } from 'lucide-react';

type TaskPullRequestLinkProps = {
  href: string;
};

export function TaskPullRequestLink({ href }: TaskPullRequestLinkProps) {
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

      <span className="truncate text-foreground">Pull request</span>
    </a>
  );
}
