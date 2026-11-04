import { RecentRunsSkeleton } from '@/components/features/stations/activity/RecentRunsSkeleton';
import { ACTIVITY_LAYOUT } from '@/components/features/stations/activity/StationActivity';
import { StationAttentionSkeleton } from '@/components/features/stations/activity/StationAttentionSkeleton';
import { SummarySkeleton } from '@/components/features/stations/activity/SummarySkeleton';

export function StationActivitySkeleton() {
  return (
    <div className={ACTIVITY_LAYOUT}>
      <SummarySkeleton />
      <StationAttentionSkeleton />
      <RecentRunsSkeleton />
    </div>
  );
}
