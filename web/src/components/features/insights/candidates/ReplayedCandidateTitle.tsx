import { ReplayStatePill } from '@/components/features/replays/ReplayStatePill';
import { Pill } from '@/components/shared/Pill';
import { markShown, type SetCandidate } from '@/lib/insights-candidates';

type ReplayedCandidateTitleProps = {
  candidate: SetCandidate;
};

export function ReplayedCandidateTitle({
  candidate,
}: ReplayedCandidateTitleProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="min-w-0 truncate font-medium font-mono text-foreground">
        {candidate.name}
      </span>
      <Pill>{markShown(candidate.kind)}</Pill>
      {candidate.onFrontier && (
        <Pill className="text-primary">On the frontier</Pill>
      )}
      {candidate.replayState && candidate.replayState !== 'finished' && (
        <ReplayStatePill state={candidate.replayState} />
      )}
    </div>
  );
}
