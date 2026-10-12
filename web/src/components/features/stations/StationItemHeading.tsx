import type { ReactNode } from 'react';
import { StationMark } from '@/components/features/stations/StationMark';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { stationShare } from '@/lib/station';

type StationItemHeadingProps = {
  line: LineResponseDto | undefined;
  station: StationResponseDto | undefined;
  title: string;
  marks?: ReactNode;
  children: ReactNode;
};

export function StationItemHeading({
  line,
  station,
  title,
  marks,
  children,
}: StationItemHeadingProps) {
  return (
    <div className="flex shrink-0 items-center gap-3 px-3 pt-2 pb-1">
      {line && station && (
        <StationMark
          share={stationShare(
            line.stations.findIndex((each) => each.id === station.id),
            line.stations.length,
          )}
          color={station.color}
        />
      )}

      <div className="flex min-w-0 flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate font-semibold text-2xl text-foreground leading-8 tracking-tight">
            {title}
          </h1>
          {marks}
        </div>
        <p className="text-muted-foreground text-sm leading-5">{children}</p>
      </div>
    </div>
  );
}
