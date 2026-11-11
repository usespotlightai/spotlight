import { StationIcon } from '@/components/features/board/column/StationIcon';
import { ActivityPeriodPicker } from '@/components/features/stations/activity/ActivityPeriodPicker';
import { STATION_COLUMN } from '@/components/features/stations/station-column';
import { StationTabs } from '@/components/features/stations/StationTabs';
import { PageTitle } from '@/components/shared/PageTitle';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
import { type StationTab, stationShare } from '@/lib/station';
import { cn } from '@/lib/utils';

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
  return (
    <div className="flex shrink-0 flex-col gap-3 pt-3">
      <div className={cn(STATION_COLUMN, 'flex min-w-0 flex-col gap-1')}>
        <div className="flex min-w-0 items-center justify-between gap-3">
          <PageTitle
            lead={
              <StationIcon
                share={stationShare(
                  line.stations.findIndex((each) => each.id === station.id),
                  line.stations.length,
                )}
                color={station.color}
                className="size-[1.125rem]"
              />
            }
          >
            {station.name}
          </PageTitle>
          {station.kind === 'work' && tab === 'activity' && (
            <ActivityPeriodPicker />
          )}
        </div>

        {station.description && (
          <p className="text-muted-foreground text-sm leading-5">
            {station.description}
          </p>
        )}
      </div>

      {station.kind === 'work' && (
        <div className="border-border border-b">
          <div className={STATION_COLUMN}>
            <StationTabs
              slug={slug}
              teamId={teamId}
              lineId={line.id}
              station={station}
              current={tab}
            />
          </div>
        </div>
      )}
    </div>
  );
}
