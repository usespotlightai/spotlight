import { StationIcon } from '@/components/features/board/column/StationIcon';
import { FixedSettings } from '@/components/features/stations/FixedSettings';
import { ImproveStationLink } from '@/components/features/stations/ImproveStationLink';
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
  const works = station.kind === 'work';

  return (
    <div className="flex flex-col gap-3">
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

        {works && (
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
            className="ml-auto"
          />
        )}
      </div>

      {station.description && (
        <p className="text-foreground text-sm leading-6">
          {station.description}
        </p>
      )}

      {works && (
        <div className="-ml-2 flex flex-wrap items-center gap-2">
          <FixedSettings
            slug={slug}
            harness={station.harness}
            model={station.model}
            effort={station.effort}
            repositories={line.repositories}
          />
        </div>
      )}
    </div>
  );
}
