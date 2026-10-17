import { CreateReplaySetAction } from '@/components/features/replays/station/CreateReplaySetAction';
import { ReplaySets } from '@/components/features/replays/station/ReplaySets';
import { StationSearches } from '@/components/features/searches/station/StationSearches';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { ImproveCard } from '@/components/features/stations/improve/ImproveCard';
import { ImproveSection } from '@/components/features/stations/improve/ImproveSection';
import { WorthImproving } from '@/components/features/stations/improve/WorthImproving';
import { useSearchStart } from '@/hooks/useSearchStart';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { signalAsk } from '@/lib/insights';
import { loading } from '@/lib/query';
import { REPLAYS_ANCHOR } from '@/lib/replay';
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
  const { searches, sets } = useSearchStart(at);
  const improving = {
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
              improving={improving}
              label="Review with the agent"
              variant="default"
            />
          }
          askAbout={(reading) => (
            <ImproveStationLink
              slug={slug}
              teamId={teamId}
              improving={improving}
              label="Ask the agent"
              ask={signalAsk(reading)}
            />
          )}
        />
      </ImproveSection>

      <ImproveSection title="Try a change">
        <div className="grid gap-3 lg:grid-cols-2">
          <ImproveCard
            id={REPLAYS_ANCHOR}
            title="Replay sets"
            description="A few past runs to replay under a candidate. Spotlight compares the results with the original runs."
            loading={loading(sets)}
            loadingLabel="Loading the replay sets"
            footer
          >
            <ReplaySets at={at} />
            <CreateReplaySetAction at={at} />
          </ImproveCard>

          <ImproveCard
            id={SEARCHES_ANCHOR}
            title="Searches"
            description="An agent proposes configs and replays each on a replay set. It looks for one that does better for less."
            loading={loading(searches)}
            loadingLabel="Loading the searches"
            footer
          >
            <StationSearches at={at} />
          </ImproveCard>
        </div>
      </ImproveSection>
    </>
  );
}
