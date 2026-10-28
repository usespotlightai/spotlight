import { ClosedPullRequestNote } from '@/components/features/searches/search/ClosedPullRequestNote';
import { FailedPullRequest } from '@/components/features/searches/search/FailedPullRequest';
import { ViewPullRequest } from '@/components/features/searches/search/ViewPullRequest';
import type { SearchCandidate } from '@/lib/search';
import { formatPullRequestState } from '@/lib/search-words';

export function PickedPullRequest({
  pullRequest,
}: {
  pullRequest: SearchCandidate['pullRequest'];
}) {
  if (!pullRequest) {
    return null;
  }

  return (
    <div
      data-slot="picked-pull-request"
      aria-live="polite"
      className="flex flex-col items-start gap-2 text-xs leading-5"
    >
      {pullRequest.state === 'failed' && (
        <FailedPullRequest reason={pullRequest.reason} />
      )}
      {pullRequest.state !== 'failed' && pullRequest.state !== 'opened' && (
        <p
          data-slot="pull-request-state"
          className="inline-flex items-center gap-1.5 text-muted-foreground"
        >
          {formatPullRequestState(pullRequest.state)}
          <ClosedPullRequestNote pullRequest={pullRequest} />
        </p>
      )}
      {pullRequest.state !== 'failed' && pullRequest.state !== 'opening' && (
        <ViewPullRequest url={pullRequest.url} />
      )}
    </div>
  );
}
