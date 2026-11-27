import { TabLinks } from '@/components/shared/TabLinks';
import type { StationResponseDto } from '@/lib/api';
import { type StationTab, stationTabPath, stationTabsOf } from '@/lib/station';
import { cn } from '@/lib/utils';

type StationTabsProps = {
  slug: string;
  teamId: string;
  lineId: string;
  station: StationResponseDto;
  current: StationTab;
  className?: string;
};

export function StationTabs({
  slug,
  teamId,
  lineId,
  station,
  current,
  className,
}: StationTabsProps) {
  return (
    <TabLinks
      label="Station"
      current={current}
      variant="underline"
      className={cn('-ml-2', className)}
      tabs={stationTabsOf(station).map((tab) => ({
        id: tab.id,
        label: tab.label,
        to: stationTabPath(slug, teamId, lineId, station.id, tab.id),
      }))}
    />
  );
}
