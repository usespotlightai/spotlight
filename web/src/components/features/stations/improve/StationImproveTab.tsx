import { ProposeCandidate } from '@/components/features/replays/station/ProposeCandidate';
import { ReplaySets } from '@/components/features/replays/station/ReplaySets';
import { StationCandidates } from '@/components/features/replays/station/StationCandidates';
import { StationSearches } from '@/components/features/searches/station/StationSearches';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { Step } from '@/components/shared/steps/Step';
import { Steps } from '@/components/shared/steps/Steps';
import { useStationCandidates } from '@/hooks/api/useStationCandidates';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { REPLAYS_ANCHOR, stationAddress } from '@/lib/replay';
import { SEARCHES_ANCHOR } from '@/lib/search';

type StationImproveTabProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function StationImproveTab({
  slug,
  teamId,
  line,
  station,
}: StationImproveTabProps) {
  const at = { slug, teamId, lineId: line.id, stationId: station.id };
  const { address, candidates, addressFailed } = useStationCandidates(at);

  return (
    <Steps>
      <Step
        title="Talk it through with the agent"
        description="The team’s agent reads the station’s config and recent runs. It suggests what to change."
      >
        <ImproveStationLink
          slug={slug}
          teamId={teamId}
          improving={{
            lineId: line.id,
            lineKey: line.key,
            lineName: line.name,
            stationId: station.id,
            stationKey: station.key,
            stationName: station.name,
          }}
          className="w-fit"
        />
      </Step>

      <Step
        id={REPLAYS_ANCHOR}
        title="Pick past runs to replay"
        description="Replay set: a few past runs to replay under a candidate. Results compare with the original runs."
      >
        <ReplaySets at={at} />
      </Step>

      <Step
        title="Propose candidates"
        description="Candidate: the station as you’d like to try it. Replaying it never changes the station."
      >
        <StationCandidates
          candidates={candidates}
          waiting={!address && !addressFailed}
          failedToPlace={addressFailed}
        />
        <ProposeCandidate
          slug={slug}
          address={address ?? stationAddress('<team>', line.key, station.key)}
        />
      </Step>

      <Step
        id={SEARCHES_ANCHOR}
        title="Or let a search find one"
        description="Search: an agent proposes configs and replays each on a replay set. It looks for one that does better for less."
      >
        <StationSearches at={at} />
      </Step>
    </Steps>
  );
}
