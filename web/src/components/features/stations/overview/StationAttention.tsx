import { useId } from 'react';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
import { ATTENTION_TITLE } from '@/components/features/stations/overview/attention';
import { StationImprovement } from '@/components/features/stations/overview/StationImprovement';
import { WorthImproving } from '@/components/features/stations/overview/WorthImproving';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { signalPrompt } from '@/lib/insights';
import type { ReplayedStation } from '@/lib/replay';

type StationAttentionProps = {
  line: LineResponseDto;
  station: StationResponseDto;
  at: ReplayedStation;
};

export function StationAttention({ line, station, at }: StationAttentionProps) {
  const titleId = useId();
  const targetStation = {
    lineId: line.id,
    lineKey: line.key,
    lineName: line.name,
    stationId: station.id,
    stationKey: station.key,
    stationName: station.name,
  };

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1.5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h2 id={titleId} className="font-medium text-foreground text-xs">
          {ATTENTION_TITLE}
        </h2>
        <StationImprovement at={at} />
      </div>

      <WorthImproving
        teamId={at.teamId}
        stationId={station.id}
        action={
          <ImproveStationLink
            slug={at.slug}
            teamId={at.teamId}
            targetStation={targetStation}
            label="Review with agent"
            size="regular"
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
    </section>
  );
}
