import { FailedPullRequest } from '@/components/features/searches/search/FailedPullRequest';
import { ViewPullRequest } from '@/components/features/searches/search/ViewPullRequest';
import type { SearchCandidate } from '@/lib/search';
import { formatPullRequestState } from '@/lib/search-words';

export function PickedPullRequest({
  candidate,
}: {
  candidate: SearchCandidate;
}) {
  const pullRequest = candidate.pullRequest;

  if (!pullRequest) {
    return null;
  }

  return (
    <div
      data-slot="picked-pull-request"
      aria-live="polite"
      className="flex flex-col items-start gap-2 text-xs leading-5"
    >
      {pullRequest.state === 'opened' && (
        <ViewPullRequest url={pullRequest.url} />
      )}
      {pullRequest.state === 'failed' && (
        <FailedPullRequest reason={pullRequest.reason} />
      )}
      {pullRequest.state === 'opening' && (
        <p className="text-muted-foreground">
          {formatPullRequestState(pullRequest.state)}
        </p>
      )}
    </div>
  );
}
