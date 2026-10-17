import { GitPullRequestArrow } from 'lucide-react';
import { FailedPullRequest } from '@/components/features/searches/search/FailedPullRequest';
import { OpenedPullRequest } from '@/components/features/searches/search/OpenedPullRequest';
import { PullRequestOpening } from '@/components/features/searches/search/PullRequestOpening';
import { Button } from '@/components/ui/button';
import { usePickSearchCandidate } from '@/hooks/api/usePickSearchCandidate';
import { pickProblem, type SearchCandidate } from '@/lib/search';
import { ONLY_ON_SEEN_TASKS_PICK } from '@/lib/search-words';

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
  const problem = pickProblem(candidate);
  const asked = () =>
    pick.mutate({ teamId, searchId, candidateId: candidate.candidateId });

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
      {opened?.state === 'failed' && (
        <FailedPullRequest reason={opened.reason} />
      )}

      {candidate.onlyOnSeenTasks === 'marked' && !opened && (
        <p role="note" className="text-amber-700 leading-5 dark:text-amber-300">
          {ONLY_ON_SEEN_TASKS_PICK}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="xs"
          variant={opened ? 'outline' : 'default'}
          className="rounded-full"
          disabled={problem !== null || pick.isPending}
          onClick={asked}
        >
          <GitPullRequestArrow aria-hidden />
          {pick.isPending ? 'Picking…' : opened ? 'Retry' : 'Pick'}
        </Button>
        {problem ? (
          <span className="text-muted-foreground">{problem}</span>
        ) : (
          !opened && (
            <span className="text-muted-foreground">
              Picking opens a pull request that changes the station to this
              config.
            </span>
          )
        )}
      </div>
    </div>
  );
}
