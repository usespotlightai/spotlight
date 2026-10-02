import { ProposeCandidate } from '@/components/features/replays/station/ProposeCandidate';
import { ReplaySets } from '@/components/features/replays/station/ReplaySets';
import { StationCandidates } from '@/components/features/replays/station/StationCandidates';
import { StationSection } from '@/components/features/stations/StationSection';
import { useStationCandidates } from '@/hooks/api/useStationCandidates';
import {
  REPLAYS_ANCHOR,
  type ReplayedStation,
  stationAddress,
} from '@/lib/replay';

type StationReplaysProps = {
  at: ReplayedStation;
  lineKey: string;
  stationKey: string;
};

export function StationReplays({
  at,
  lineKey,
  stationKey,
}: StationReplaysProps) {
  const { address, candidates, addressFailed } = useStationCandidates(at);

  return (
    <StationSection title="Replays" id={REPLAYS_ANCHOR}>
      <p className="text-muted-foreground text-sm leading-6">
        Replay some of this station’s past tasks under a candidate config, and
        see whether it does better than the station does now.
      </p>

      <ReplaySets at={at} />

      <StationCandidates
        candidates={candidates}
        waiting={!address && !addressFailed}
        failedToPlace={addressFailed}
      />

      <ProposeCandidate
        slug={at.slug}
        address={address ?? stationAddress('<team>', lineKey, stationKey)}
      />
    </StationSection>
  );
}
