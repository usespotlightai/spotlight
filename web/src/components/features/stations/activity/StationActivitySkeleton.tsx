import { useSearchParams } from 'react-router';

import { RecentRunsSkeleton } from '@/components/features/stations/activity/RecentRunsSkeleton';
import { ACTIVITY_LAYOUT } from '@/components/features/stations/activity/StationActivity';
import { StationAttentionSkeleton } from '@/components/features/stations/activity/StationAttentionSkeleton';
import { SummarySkeleton } from '@/components/features/stations/activity/SummarySkeleton';
import { activityPeriodOf } from '@/lib/station';

export function StationActivitySkeleton() {
  const [params] = useSearchParams();

  return (
    <div className={ACTIVITY_LAYOUT}>
      <SummarySkeleton period={activityPeriodOf(params)} />
      <StationAttentionSkeleton />
      <RecentRunsSkeleton />
    </div>
  );
}
