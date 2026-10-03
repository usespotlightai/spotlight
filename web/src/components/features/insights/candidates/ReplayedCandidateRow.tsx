import { ReplayedAgainstLive } from '@/components/features/insights/candidates/ReplayedAgainstLive';
import { ReplayedCandidateFigures } from '@/components/features/insights/candidates/ReplayedCandidateFigures';
import { ReplayedCandidateLinks } from '@/components/features/insights/candidates/ReplayedCandidateLinks';
import { ReplayedCandidateTitle } from '@/components/features/insights/candidates/ReplayedCandidateTitle';
import { ChangedFromLive } from '@/components/features/replays/ChangedFromLive';
import { comparedShown, type SetCandidate } from '@/lib/insights-candidates';
import type { ReplayedStation } from '@/lib/replay';
import { configChangesOf } from '@/lib/station-config';

type ReplayedCandidateRowProps = {
  at: ReplayedStation;
  candidate: SetCandidate;
};

export function ReplayedCandidateRow({
  at,
  candidate,
}: ReplayedCandidateRowProps) {
  return (
    <li
      data-slot="replayed-candidate"
      className="flex min-w-0 flex-col gap-1.5 py-2 text-sm"
    >
      <ReplayedCandidateTitle candidate={candidate} />

      {candidate.hypothesis && (
        <p className="whitespace-pre-line text-foreground text-sm leading-6">
          {candidate.hypothesis}
        </p>
      )}

      <ChangedFromLive
        changes={configChangesOf(candidate.changes)}
        same="The same as the live config."
      />

      <ReplayedCandidateFigures candidate={candidate} />

      <ReplayedAgainstLive candidate={candidate} />

      <p data-slot="compared" className="text-muted-foreground text-xs">
        {comparedShown(candidate)}
      </p>

      <ReplayedCandidateLinks at={at} candidate={candidate} />
    </li>
  );
}
