import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { CreateReplaySetAction } from '@/components/features/replays/station/CreateReplaySetAction';
import { ReplaySets } from '@/components/features/replays/station/ReplaySets';
import { StationSearches } from '@/components/features/searches/station/StationSearches';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { ImproveSection } from '@/components/features/stations/improve/ImproveSection';
import { WorthImproving } from '@/components/features/stations/improve/WorthImproving';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { signalPrompt } from '@/lib/insights';
import { REPLAY_SETS_NOTE, REPLAYS_ANCHOR } from '@/lib/replay';
import { SEARCHES_ANCHOR, SEARCHES_NOTE } from '@/lib/search';

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
  const targetStation = {
    lineId: line.id,
    lineKey: line.key,
    lineName: line.name,
    stationId: station.id,
    stationKey: station.key,
    stationName: station.name,
  };

  return (
    <>
      <ImproveSection title="What needs attention">
        <WorthImproving
          teamId={teamId}
          stationId={station.id}
          action={
            <ImproveStationLink
              slug={slug}
              teamId={teamId}
              targetStation={targetStation}
              label="Review with agent"
              size="regular"
            />
          }
          actionFor={(reading) => (
            <ImproveStationLink
              slug={slug}
              teamId={teamId}
              targetStation={targetStation}
              label="Ask the agent"
              prompt={signalPrompt(reading)}
            />
          )}
        />
      </ImproveSection>

      <ImproveSection title="Try a change">
        <div className="grid gap-3 lg:grid-cols-2">
          <InsightsCard
            id={REPLAYS_ANCHOR}
            tableOnly
            title="Replay sets"
            description={REPLAY_SETS_NOTE}
          >
            <ReplaySets at={at} />
            <CreateReplaySetAction at={at} />
          </InsightsCard>

          <InsightsCard
            id={SEARCHES_ANCHOR}
            tableOnly
            title="Searches"
            description={SEARCHES_NOTE}
          >
            <StationSearches at={at} />
          </InsightsCard>
        </div>
      </ImproveSection>
    </>
  );
}
