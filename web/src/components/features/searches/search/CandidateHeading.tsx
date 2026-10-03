import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { OnlyOnSeenTasksBadge } from '@/components/features/searches/OnlyOnSeenTasksBadge';
import { Pill } from '@/components/shared/Pill';
import { candidateName, type SearchCandidate } from '@/lib/search';
import { cn } from '@/lib/utils';

type CandidateHeadingProps = {
  candidate: SearchCandidate;
};

export function CandidateHeading({ candidate }: CandidateHeadingProps) {
  return (
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
      {candidate.onlyOnSeenTasks && (
        <OnlyOnSeenTasksBadge mark={candidate.onlyOnSeenTasks} />
      )}
      {candidate.replayState && candidate.replayState !== 'finished' && (
        <ReplayStatePill state={candidate.replayState} />
      )}
    </div>
  );
}
