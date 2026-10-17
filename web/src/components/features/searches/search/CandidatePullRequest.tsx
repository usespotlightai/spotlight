import { NotedWarning } from '@/components/shared/NotedWarning';
import type { SearchCandidate } from '@/lib/search';
import {
  formatPullRequestCell,
  formatPullRequestReason,
} from '@/lib/search-words';

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
        className="relative z-10 text-foreground underline-offset-2 hover:underline"
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
          <NotedWarning
            tone="destructive"
            label="Why"
            note={`${formatPullRequestReason(opened.reason)}. ${opened.reason.message}`}
            className="relative z-10"
          />
        )}
      </span>
    );
  }

  return formatPullRequestCell(opened.state);
}
