import { ExternalLink, GitPullRequestArrow } from 'lucide-react';
import { formatPullRequestState } from '@/lib/search-words';

type OpenedPullRequestProps = {
  url: string | null;
};

export function OpenedPullRequest({ url }: OpenedPullRequestProps) {
  return (
    <p data-slot="pull-request" className="flex items-center gap-1.5 text-xs">
      <GitPullRequestArrow aria-hidden className="size-3.5 text-primary" />
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
        >
          {formatPullRequestState('opened')}
          <ExternalLink aria-hidden className="size-3" />
        </a>
      ) : (
        <span className="text-foreground">
          {formatPullRequestState('opened')}
        </span>
      )}
    </p>
  );
}
