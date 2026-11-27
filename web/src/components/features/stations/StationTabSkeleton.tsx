import { ACTIVITY_LAYOUT } from '@/components/features/stations/activity/StationActivity';
import { StationActivitySkeleton } from '@/components/features/stations/activity/StationActivitySkeleton';
import { StationConfigSkeleton } from '@/components/features/stations/config/StationConfigSkeleton';
import { JudgeAgreementSkeleton } from '@/components/features/stations/judge/JudgeAgreementSkeleton';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';
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

type StationTabSkeletonProps = {
  tab: StationTab;
  line?: LineResponseDto;
  station?: StationResponseDto;
};

export function StationTabSkeleton({
  tab,
  line,
  station,
}: StationTabSkeletonProps) {
  const label = STATION_TABS.find((each) => each.id === tab)?.label ?? '';
  const Body = BODIES[tab];

  return (
    <div role="status" aria-label={`Loading the ${label.toLowerCase()} tab`}>
      {tab === 'config' ? (
        <StationConfigSkeleton line={line} station={station} />
      ) : (
        <Body />
      )}
    </div>
  );
}
