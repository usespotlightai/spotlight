import { StationIcon } from '@/components/features/board/column/StationIcon';
import { StationAgentLine } from '@/components/features/stations/StationAgentLine';
import { StationTabs } from '@/components/features/stations/StationTabs';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { type StationTab, stationShare } from '@/lib/station';

type StationHeadingProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
  tab: StationTab;
};

export function StationHeading({
  slug,
  teamId,
  line,
  station,
  tab,
}: StationHeadingProps) {
  const works = station.kind === 'work';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <span className="mt-1 p-0.5">
            <StationIcon
              share={stationShare(
                line.stations.findIndex((each) => each.id === station.id),
                line.stations.length,
              )}
              color={station.color}
              className="size-5"
            />
          </span>

          <h1 className="font-semibold text-2xl text-foreground leading-8 tracking-tight">
            {station.name}
          </h1>
        </div>

        {station.description && (
          <p className="text-foreground text-sm leading-6">
            {station.description}
          </p>
        )}

        {works && (
          <StationAgentLine
            harness={station.harness}
            model={station.model}
            effort={station.effort}
          />
        )}
      </div>

      {works && (
        <StationTabs
          slug={slug}
          teamId={teamId}
          lineId={line.id}
          stationId={station.id}
          current={tab}
        />
      )}
    </div>
  );
}
