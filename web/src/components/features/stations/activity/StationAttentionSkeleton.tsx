import { ATTENTION_TITLE } from '@/components/features/stations/activity/attention';
import { TabSection } from '@/components/features/stations/TabSection';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function StationAttentionSkeleton() {
  return (
    <TabSection title={ATTENTION_TITLE}>
      <SkeletonLine className="w-72 text-sm" />
    </TabSection>
  );
}
