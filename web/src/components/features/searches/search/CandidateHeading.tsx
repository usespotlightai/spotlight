import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { OverfitBadge } from '@/components/features/searches/OverfitBadge';
import { Pill } from '@/components/shared/Pill';
import { candidateName, type SearchCandidate } from '@/lib/search';

type CandidateHeadingProps = {
  candidate: SearchCandidate;
};

export function CandidateHeading({ candidate }: CandidateHeadingProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="min-w-0 truncate font-medium text-foreground">
        {candidateName(candidate)}
      </span>
      {candidate.onFrontier && (
        <Pill className="text-primary">On the frontier</Pill>
      )}
      {candidate.overfit && <OverfitBadge mark={candidate.overfit} />}
      {candidate.replayState && candidate.replayState !== 'finished' && (
        <ReplayStatePill state={candidate.replayState} />
      )}
    </div>
  );
}
