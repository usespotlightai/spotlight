import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { SearchCandidate } from '@/lib/search';
import { formatPullRequestClosed } from '@/lib/search-words';
import { cn } from '@/lib/utils';

export function ClosedPullRequestNote({
  pullRequest,
  className,
}: {
  pullRequest: NonNullable<SearchCandidate['pullRequest']>;
  className?: string;
}) {
  const note = formatPullRequestClosed(pullRequest);

  return (
    note && (
      <span
        data-slot="closed-pull-request-note"
        className={cn('inline-flex', className)}
      >
        <InfoTooltip tooltip={note} />
      </span>
    )
  );
}
