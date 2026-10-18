import { StationImproveSkeleton } from '@/components/features/stations/improve/StationImproveSkeleton';
import { StationOverviewSkeleton } from '@/components/features/stations/overview/StationOverviewSkeleton';
import { STATION_TABS, type StationTab } from '@/lib/station';

const BODIES = {
  overview: StationOverviewSkeleton,
  improve: StationImproveSkeleton,
} as const;

export function StationTabSkeleton({ tab }: { tab: StationTab }) {
  const Body = BODIES[tab];
  const label = STATION_TABS.find((each) => each.id === tab)?.label ?? '';

  return (
    <div
      role="status"
      aria-label={`Loading the ${label.toLowerCase()} tab`}
      className="flex flex-col gap-3"
    >
      <Body />
    </div>
  );
}
