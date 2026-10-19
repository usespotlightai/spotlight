import { GitPullRequestArrow, Loader2 } from 'lucide-react';
import { FailedPullRequest } from '@/components/features/searches/search/FailedPullRequest';
import { ViewPullRequest } from '@/components/features/searches/search/ViewPullRequest';
import { Button } from '@/components/ui/button';
import { usePickSearchCandidate } from '@/hooks/api/usePickSearchCandidate';
import { pickProblem, type SearchCandidate } from '@/lib/search';
import {
  OPEN_PULL_REQUEST,
  OPENING_PULL_REQUEST,
  RETRY_PULL_REQUEST,
} from '@/lib/search-words';
import { cn } from '@/lib/utils';

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
  const opening = pick.isPending || opened?.state === 'opening';
  const pickCandidate = () =>
    pick.mutate({ teamId, searchId, candidateId: candidate.candidateId });

  if (candidate.isSeed) {
    return null;
  }

  if (opened?.state === 'opened') {
    return (
      <div data-slot="pick">
        <ViewPullRequest url={opened.url} />
      </div>
    );
  }

  const failed = opened?.state === 'failed';
  return (
    <div
      data-slot="pick"
      aria-live="polite"
      className="flex flex-col items-start gap-2 text-xs leading-5"
    >
      {failed && opened && <FailedPullRequest reason={opened.reason} />}
      {problem && <p className="text-muted-foreground">{problem}</p>}

      <Button
        type="button"
        size="sm"
        variant={failed ? 'outline' : 'default'}
        className={cn('rounded-full shadow-none', failed && 'bg-card')}
        disabled={problem !== null || opening}
        onClick={pickCandidate}
      >
        {opening ? (
          <Loader2 aria-hidden className="animate-spin" />
        ) : (
          <GitPullRequestArrow aria-hidden />
        )}
        {opening
          ? OPENING_PULL_REQUEST
          : failed
            ? RETRY_PULL_REQUEST
            : OPEN_PULL_REQUEST}
      </Button>
    </div>
  );
}
