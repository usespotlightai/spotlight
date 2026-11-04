import { STATION_COLUMN } from '@/components/features/stations/station-column';
import { TabLinks } from '@/components/shared/TabLinks';
import { STATION_TABS, type StationTab, stationTabPath } from '@/lib/station';
import { cn } from '@/lib/utils';

type StationTabsProps = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
  current: StationTab;
};

export function StationTabs({
  slug,
  teamId,
  lineId,
  stationId,
  current,
}: StationTabsProps) {
  return (
    <TabLinks
      label="Station"
      current={current}
      variant="underline"
      className={cn(STATION_COLUMN, 'pl-1')}
      tabs={STATION_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        to: stationTabPath(slug, teamId, lineId, stationId, tab.id),
      }))}
    />
  );
}
