import { ATTENTION_TITLE } from '@/components/features/stations/activity/attention';
import { WorthImproving } from '@/components/features/stations/activity/WorthImproving';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { TabSection } from '@/components/features/stations/TabSection';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { signalPrompt, WORTH_IMPROVING_NOTE } from '@/lib/insights';
import type { ReplayedStation } from '@/lib/replay';

type StationAttentionProps = {
  line: LineResponseDto;
  station: StationResponseDto;
  at: ReplayedStation;
};

export function StationAttention({ line, station, at }: StationAttentionProps) {
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
      action={<InfoTooltip tooltip={WORTH_IMPROVING_NOTE} />}
    >
      <WorthImproving
        teamId={at.teamId}
        stationId={station.id}
        action={
          <ImproveStationLink
            slug={at.slug}
            teamId={at.teamId}
            targetStation={targetStation}
            label="Review with agent"
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
    </TabSection>
  );
}
