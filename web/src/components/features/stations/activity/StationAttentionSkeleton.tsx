import { ATTENTION_TITLE } from '@/components/features/stations/activity/attention';
import { FAILURES_TITLE } from '@/components/features/stations/activity/StationFailureReasons';
import { TabSection } from '@/components/features/stations/TabSection';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function StationAttentionSkeleton() {
  return (
    <TabSection title={ATTENTION_TITLE}>
      <Skeleton className="h-[5.5rem] w-full rounded-md" />
      <TabSection level={3} title={FAILURES_TITLE}>
        <SkeletonLine className="w-40 text-sm" />
      </TabSection>
    </TabSection>
  );
}
