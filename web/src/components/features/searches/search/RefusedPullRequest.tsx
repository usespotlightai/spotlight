import { PullRequestRefusal } from '@/components/features/searches/search/PullRequestRefusal';
import {
  type PullRequestReason,
  pullRequestStateShown,
} from '@/lib/search-words';

type RefusedPullRequestProps = {
  reason: PullRequestReason | null;
};

export function RefusedPullRequest({ reason }: RefusedPullRequestProps) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border px-2.5 py-2">
      <p className="font-medium text-destructive">
        {pullRequestStateShown('refused')}
      </p>
      {reason && <PullRequestRefusal reason={reason} />}
    </div>
  );
}
