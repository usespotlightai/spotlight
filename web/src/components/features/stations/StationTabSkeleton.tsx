import { StationActivitySkeleton } from '@/components/features/stations/activity/StationActivitySkeleton';
import { StationConfigSkeleton } from '@/components/features/stations/config/StationConfigSkeleton';
import { STATION_TABS, type StationTab } from '@/lib/station';

const BODIES = {
  activity: StationActivitySkeleton,
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
