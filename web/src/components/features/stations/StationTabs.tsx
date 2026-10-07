import { TabLinks } from '@/components/shared/TabLinks';
import { STATION_TABS, type StationTab, stationTabPath } from '@/lib/station';

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
      tabs={STATION_TABS.map((tab) => ({
        id: tab.id,
        label: tab.label,
        to: stationTabPath(slug, teamId, lineId, stationId, tab.id),
      }))}
    />
  );
}
