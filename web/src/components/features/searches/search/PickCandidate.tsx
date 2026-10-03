import { ExternalLink, GitPullRequestArrow, Loader2 } from 'lucide-react';
import { PullRequestRefusal } from '@/components/features/searches/search/PullRequestRefusal';
import { Button } from '@/components/ui/button';
import { usePickSearchCandidate } from '@/hooks/api/usePickSearchCandidate';
import { messageOf } from '@/lib/error';
import { pickRefusal, type SearchCandidate } from '@/lib/search';
import {
  ONLY_ON_SEEN_TASKS_PICK,
  pullRequestStateShown,
} from '@/lib/search-words';

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
    return (
      <p
        data-slot="pull-request"
        role="status"
        className="flex items-center gap-1.5 text-muted-foreground text-xs"
      >
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        {pullRequestStateShown('opening')}
      </p>
    );
  }

  if (opened?.state === 'opened') {
    return (
      <p data-slot="pull-request" className="flex items-center gap-1.5 text-xs">
        <GitPullRequestArrow aria-hidden className="size-3.5 text-primary" />
        {opened.url ? (
          <a
            href={opened.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
          >
            {pullRequestStateShown('opened')}
            <ExternalLink aria-hidden className="size-3" />
          </a>
        ) : (
          <span className="text-foreground">
            {pullRequestStateShown('opened')}
          </span>
        )}
      </p>
    );
  }

  return (
    <div data-slot="pick" className="flex flex-col gap-1.5 text-xs">
      {opened?.state === 'refused' && (
        <div className="flex flex-col gap-1 rounded-lg border border-border px-2.5 py-2">
          <p className="font-medium text-destructive">
            {pullRequestStateShown('refused')}
          </p>
          {opened.reason && <PullRequestRefusal reason={opened.reason} />}
        </div>
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
