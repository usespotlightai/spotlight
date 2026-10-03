import { GainVerdict } from '@/components/features/replays/GainVerdict';
import { RateWithInterval } from '@/components/features/replays/RateWithInterval';
import {
  costAgainstLiveShown,
  onTheSameShown,
  type SetCandidate,
  VERSUS_LIVE,
} from '@/lib/insights-candidates';

type ReplayedAgainstLiveProps = {
  candidate: SetCandidate;
};

export function ReplayedAgainstLive({ candidate }: ReplayedAgainstLiveProps) {
  const costAgainstLive = costAgainstLiveShown(candidate);

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
            <RateWithInterval
              rate={candidate.successRateOnCompared}
              interval={candidate.intervalOnCompared}
            />{' '}
            <span className="text-muted-foreground">{VERSUS_LIVE}</span>{' '}
            <RateWithInterval
              rate={candidate.live.successRate}
              interval={candidate.live.interval}
            />{' '}
            <span className="text-muted-foreground">
              {onTheSameShown(candidate.compared)}
            </span>
          </span>
          {candidate.againstLive && (
            <GainVerdict gain={candidate.againstLive} />
          )}
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
