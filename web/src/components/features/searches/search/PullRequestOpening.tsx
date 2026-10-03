import { Loader2 } from 'lucide-react';
import { pullRequestStateShown } from '@/lib/search-words';

export function PullRequestOpening() {
  return (
    <p
      data-slot="pull-request"
      role="status"
      className="flex items-center gap-1.5 text-muted-foreground text-xs"
    >
      <Loader2 aria-hidden className="size-3.5 animate-spin" />
      {pullRequestStateShown('opening')}
    </p>
  );
}
