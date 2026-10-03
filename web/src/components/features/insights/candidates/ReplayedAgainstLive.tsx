import { DeltaShown } from '@/components/features/insights/DeltaShown';
import {
  againstLive,
  costAgainstLiveShown,
  liveShown,
  type SetCandidate,
} from '@/lib/insights-candidates';

type ReplayedAgainstLiveProps = {
  candidate: SetCandidate;
};

export function ReplayedAgainstLive({ candidate }: ReplayedAgainstLiveProps) {
  const costAgainstLive = costAgainstLiveShown(candidate);
  const delta = againstLive(candidate).delta;

  if (candidate.compared <= 0) {
    return null;
  }

  return (
    <>
      {candidate.live && (
        <div
          data-slot="against-live"
          className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs"
        >
          <span className="text-foreground tabular-nums">
            {liveShown(candidate)}
          </span>
          {delta && <DeltaShown delta={delta} against={null} />}
        </div>
      )}

      {costAgainstLive && (
        <p
          data-slot="cost-against-live"
          className="text-muted-foreground text-xs tabular-nums"
        >
          {costAgainstLive}
        </p>
      )}
    </>
  );
}
