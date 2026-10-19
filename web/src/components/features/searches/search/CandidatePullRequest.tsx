import { SECTION_LINK } from '@/components/shared/section-link';
import { WarningTooltip } from '@/components/shared/WarningTooltip';
import type { SearchCandidate } from '@/lib/search';
import {
  formatPullRequestCell,
  formatPullRequestReason,
} from '@/lib/search-words';
import { cn } from '@/lib/utils';

export function CandidatePullRequest({
  candidate,
}: {
  candidate: SearchCandidate;
}) {
  const opened = candidate.pullRequest;

  if (!opened) {
    return '–';
  }

  if (opened.state === 'opened' && opened.url) {
    return (
      <a
        href={opened.url}
        target="_blank"
        rel="noreferrer"
        className={cn(SECTION_LINK, 'relative z-10 text-foreground')}
      >
        {formatPullRequestCell('opened')}
      </a>
    );
  }

  if (opened.state === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-destructive">
        {formatPullRequestCell('failed')}
        {opened.reason && (
          <WarningTooltip
            tone="destructive"
            label="Why"
            tooltip={`${formatPullRequestReason(opened.reason)}. ${opened.reason.message}`}
            className="relative z-10"
          />
        )}
      </span>
    );
  }

  return formatPullRequestCell(opened.state);
}
