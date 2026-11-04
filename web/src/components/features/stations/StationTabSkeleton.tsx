import { ACTIVITY_LAYOUT } from '@/components/features/stations/activity/StationActivity';
import { StationActivitySkeleton } from '@/components/features/stations/activity/StationActivitySkeleton';
import { StationConfigSkeleton } from '@/components/features/stations/config/StationConfigSkeleton';
import { JudgeAgreementSkeleton } from '@/components/features/stations/judge/JudgeAgreementSkeleton';
import { STATION_TABS, type StationTab } from '@/lib/station';

const JudgeTabSkeleton = () => (
  <div className={ACTIVITY_LAYOUT}>
    <JudgeAgreementSkeleton />
  </div>
);

const BODIES = {
  activity: StationActivitySkeleton,
  config: StationConfigSkeleton,
  judge: JudgeTabSkeleton,
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
