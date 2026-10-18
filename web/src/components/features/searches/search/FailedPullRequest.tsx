import { PullRequestError } from '@/components/features/searches/search/PullRequestError';
import {
  formatPullRequestState,
  type PullRequestReason,
} from '@/lib/search-words';

type FailedPullRequestProps = {
  reason: PullRequestReason | null;
};

export function FailedPullRequest({ reason }: FailedPullRequestProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border px-2.5 py-2">
      <p className="font-medium text-destructive">
        {formatPullRequestState('failed')}
      </p>
      {reason && <PullRequestError reason={reason} />}
    </div>
  );
}
