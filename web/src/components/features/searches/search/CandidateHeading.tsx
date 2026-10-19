import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { CandidateIcons } from '@/components/features/searches/CandidateIcons';
import { candidateName, type SearchCandidate } from '@/lib/search';

type CandidateHeadingProps = {
  candidate: SearchCandidate;
  maxRegressions: number | null;
};

export function CandidateHeading({
  candidate,
  maxRegressions,
}: CandidateHeadingProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="min-w-0 truncate font-medium text-foreground">
        {candidateName(candidate)}
      </span>
      <CandidateIcons
        candidate={candidate}
        frontier={candidate.onFrontier}
        maxRegressions={maxRegressions}
      />
      {candidate.replayState && candidate.replayState !== 'finished' && (
        <ReplayStatePill state={candidate.replayState} />
      )}
    </div>
  );
}
