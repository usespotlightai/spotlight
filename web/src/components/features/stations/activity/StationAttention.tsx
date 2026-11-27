import { ATTENTION_TITLE } from '@/components/features/stations/activity/attention';
import { StationFailureReasons } from '@/components/features/stations/activity/StationFailureReasons';
import { WorthImproving } from '@/components/features/stations/activity/WorthImproving';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { TabSection } from '@/components/features/stations/TabSection';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { signalPrompt, worthImprovingNote } from '@/lib/insights';
import { rangeOf } from '@/lib/range';
import type { ReplayedStation } from '@/lib/replay';
import {
  type ActivityPeriod,
  comparedPeriodOf,
  LIVE_CONFIG,
} from '@/lib/station';

type StationAttentionProps = {
  line: LineResponseDto;
  station: StationResponseDto;
  at: ReplayedStation;
  period: ActivityPeriod;
};

export function StationAttention({
  line,
  station,
  at,
  period,
}: StationAttentionProps) {
  const compared = comparedPeriodOf(period);
  const targetStation = {
    lineId: line.id,
    lineKey: line.key,
    lineName: line.name,
    stationId: station.id,
    stationKey: station.key,
    stationName: station.name,
  };

  return (
    <TabSection
      title={ATTENTION_TITLE}
      description={worthImprovingNote(compared)}
      scope={period === LIVE_CONFIG ? rangeOf(compared).label : undefined}
    >
      <WorthImproving
        teamId={at.teamId}
        stationId={station.id}
        period={compared}
        action={
          <ImproveStationLink
            slug={at.slug}
            teamId={at.teamId}
            targetStation={targetStation}
            label="Ask the agent"
          />
        }
        actionFor={(reading) => (
          <ImproveStationLink
            slug={at.slug}
            teamId={at.teamId}
            targetStation={targetStation}
            label="Ask the agent"
            prompt={signalPrompt(reading)}
          />
        )}
      />
      <StationFailureReasons
        slug={at.slug}
        teamId={at.teamId}
        lineId={line.id}
        stationId={station.id}
        period={period}
      />
    </TabSection>
  );
}
