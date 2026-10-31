import { StationConfigSkeleton } from '@/components/features/stations/config/StationConfigSkeleton';
import { StationOverviewSkeleton } from '@/components/features/stations/overview/StationOverviewSkeleton';
import { STATION_TABS, type StationTab } from '@/lib/station';

const BODIES = {
  overview: StationOverviewSkeleton,
  config: StationConfigSkeleton,
} as const;

export function StationTabSkeleton({ tab }: { tab: StationTab }) {
  const Body = BODIES[tab];
  const label = STATION_TABS.find((each) => each.id === tab)?.label ?? '';

  return (
    <div role="status" aria-label={`Loading the ${label.toLowerCase()} tab`}>
      <Body />
    </div>
  );
}
