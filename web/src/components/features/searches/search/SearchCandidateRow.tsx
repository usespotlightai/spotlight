import { ChangedFromLive } from '@/components/features/replays/ChangedFromLive';
import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { PickCandidate } from '@/components/features/searches/search/PickCandidate';
import { Pill } from '@/components/shared/Pill';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { type ReplayedStation, replayPath } from '@/lib/replay';
import {
  candidateName,
  costPerRunShown,
  heldOutShown,
  type SearchCandidate,
  scoreShown,
  searchCandidateAnchor,
  searchChanges,
} from '@/lib/search';
import { cn } from '@/lib/utils';

const LINK = 'text-foreground underline-offset-2 hover:underline';

type SearchCandidateRowProps = {
  at: ReplayedStation;
  searchId: string;
  candidate: SearchCandidate;
  currency: string;
};

export function SearchCandidateRow({
  at,
  searchId,
  candidate,
  currency,
}: SearchCandidateRowProps) {
  const changes = searchChanges(candidate);

  return (
    <li
      id={searchCandidateAnchor(candidate.candidateId)}
      data-slot="search-candidate"
      className="flex flex-col gap-1.5 rounded-md px-2 py-2 text-sm"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className={cn(
            'min-w-0 truncate font-medium text-foreground',
            !candidate.seed && 'font-mono',
          )}
        >
          {candidateName(candidate)}
        </span>
        {candidate.onFrontier && (
          <Pill className="text-primary">On the frontier</Pill>
        )}
        {candidate.replayState && candidate.replayState !== 'finished' && (
          <ReplayStatePill state={candidate.replayState} />
        )}
      </div>

      {candidate.hypothesis && (
        <p className="whitespace-pre-line text-foreground text-sm leading-6">
          {candidate.hypothesis}
        </p>
      )}

      {candidate.seed ? (
        <p className="text-muted-foreground text-xs">
          The station as it was configured when the search started.
        </p>
      ) : (
        <ChangedFromLive
          changes={changes}
          same="The same as the live config."
        />
      )}

      <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground text-xs">
        <div className="flex gap-1">
          <dt>Searched</dt>
          <dd className="text-foreground tabular-nums">
            {candidate.searchScored === 0 ? (
              'Not scored yet'
            ) : (
              <>
                {scoreShown(candidate.searchScore)}
                <span className="text-muted-foreground">
                  {' '}
                  of {candidate.searchScored} scored
                </span>
              </>
            )}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Held out</dt>
          <dd className="text-foreground tabular-nums">
            {heldOutShown(candidate)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Cost per run</dt>
          <dd className="text-foreground tabular-nums">
            {costPerRunShown(candidate.costPerRun, currency)}
          </dd>
        </div>
      </dl>

      <p className="flex flex-wrap gap-x-3 text-xs">
        <TrailLink to={replayPath(at, candidate.replayId)} className={LINK}>
          {candidate.seed ? 'Its replay of the set' : 'Its replay'}
        </TrailLink>
        {candidate.heldOutReplayId && (
          <TrailLink
            to={replayPath(at, candidate.heldOutReplayId)}
            className={LINK}
          >
            Its held-out replay
          </TrailLink>
        )}
      </p>

      <PickCandidate
        teamId={at.teamId}
        searchId={searchId}
        candidate={candidate}
      />
    </li>
  );
}
