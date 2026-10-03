import { GitPullRequestArrow } from 'lucide-react';
import { OpenedPullRequest } from '@/components/features/searches/search/OpenedPullRequest';
import { PullRequestOpening } from '@/components/features/searches/search/PullRequestOpening';
import { RefusedPullRequest } from '@/components/features/searches/search/RefusedPullRequest';
import { Button } from '@/components/ui/button';
import { usePickSearchCandidate } from '@/hooks/api/usePickSearchCandidate';
import { messageOf } from '@/lib/error';
import { pickRefusal, type SearchCandidate } from '@/lib/search';

type PickCandidateProps = {
  teamId: string;
  searchId: string;
  candidate: SearchCandidate;
};

export function PickCandidate({
  teamId,
  searchId,
  candidate,
}: PickCandidateProps) {
  const pick = usePickSearchCandidate();
  const opened = candidate.pullRequest;
  const refusal = pickRefusal(candidate);
  const asked = () =>
    pick.mutate({ teamId, searchId, candidateId: candidate.candidateId });
  const failedToPick = pick.isError
    ? messageOf(pick.error, 'Could not pick the candidate')
    : null;

  if (candidate.seed) {
    return null;
  }

  if (opened?.state === 'opening') {
    return <PullRequestOpening />;
  }

  if (opened?.state === 'opened') {
    return <OpenedPullRequest url={opened.url} />;
  }

  return (
    <div data-slot="pick" className="flex flex-col gap-1.5 text-xs">
      {opened?.state === 'refused' && (
        <RefusedPullRequest reason={opened.reason} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="xs"
          variant={opened ? 'outline' : 'default'}
          className="rounded-full"
          disabled={refusal !== null || pick.isPending}
          onClick={asked}
        >
          <GitPullRequestArrow aria-hidden />
          {pick.isPending ? 'Picking…' : opened ? 'Retry' : 'Pick'}
        </Button>
        {refusal ? (
          <span className="text-muted-foreground">{refusal}</span>
        ) : (
          !opened && (
            <span className="text-muted-foreground">
              Opens a pull request that changes the station to this config.
            </span>
          )
        )}
      </div>

      {failedToPick && (
        <p role="alert" className="text-destructive">
          {failedToPick}
        </p>
      )}
    </div>
  );
}
