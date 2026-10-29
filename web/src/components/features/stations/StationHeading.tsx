import { StationMark } from '@/components/features/stations/StationMark';
import { StationTabs } from '@/components/features/stations/StationTabs';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { stationShare } from '@/lib/station';

type StationHeadingProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  station: StationResponseDto;
};

export function StationHeading({
  slug,
  teamId,
  line,
  station,
}: StationHeadingProps) {
  return (
    <div className="flex shrink-0 flex-col gap-4 pt-2">
      <div className="flex min-w-0 items-center gap-3 px-3">
        <StationMark
          share={stationShare(
            line.stations.findIndex((each) => each.id === station.id),
            line.stations.length,
          )}
          color={station.color}
        />

        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-semibold text-2xl text-foreground leading-8 tracking-tight">
            {station.name}
          </h1>

          {station.description && (
            <p className="text-muted-foreground text-sm leading-5">
              {station.description}
            </p>
          )}
        </div>
      </div>

      {station.kind === 'work' && (
        <StationTabs
          slug={slug}
          teamId={teamId}
          lineId={line.id}
          stationId={station.id}
          current="overview"
        />
      )}
    </div>
  );
}
