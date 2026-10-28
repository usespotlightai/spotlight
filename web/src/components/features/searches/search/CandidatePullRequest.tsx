import { ClosedPullRequestNote } from '@/components/features/searches/search/ClosedPullRequestNote';
import { SECTION_LINK } from '@/components/shared/section-link';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import type { SearchCandidate } from '@/lib/search';
import {
  formatPullRequestCell,
  formatPullRequestReason,
} from '@/lib/search-words';
import { cn } from '@/lib/utils';

export function CandidatePullRequest({
  pullRequest,
}: {
  pullRequest: SearchCandidate['pullRequest'];
}) {
  if (!pullRequest) {
    return '–';
  }

  if (pullRequest.state === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-destructive">
        {formatPullRequestCell('failed')}
        {pullRequest.reason && (
          <WarningTooltip
            tone="destructive"
            label="Why"
            tooltip={`${formatPullRequestReason(pullRequest.reason)}. ${pullRequest.reason.message}`}
            className="relative z-10"
          />
        )}
      </span>
    );
  }

  if (!pullRequest.url) {
    return formatPullRequestCell(pullRequest.state);
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <a
        href={pullRequest.url}
        target="_blank"
        rel="noreferrer"
        className={cn(SECTION_LINK, 'relative z-10 text-foreground')}
      >
        {formatPullRequestCell(pullRequest.state)}
      </a>
      <ClosedPullRequestNote
        pullRequest={pullRequest}
        className="relative z-10"
      />
    </span>
  );
}
