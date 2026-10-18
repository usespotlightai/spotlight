import { FlowSkeleton } from '@/components/features/insights/FlowSkeleton';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { PullRequestsSkeleton } from '@/components/features/insights/pull-requests/PullRequestsSkeleton';
import { ShippingSkeleton } from '@/components/features/insights/shipping/ShippingSkeleton';
import {
  type InsightsView,
  type StationNames,
  workStationCount,
} from '@/lib/insights';

type ProductivitySkeletonProps = {
  view: InsightsView;
  names: StationNames;
  onView: (view: InsightsView) => void;
};

export function ProductivitySkeleton({
  view,
  names,
  onView,
}: ProductivitySkeletonProps) {
  return (
    <div className="flex flex-col gap-3">
      <InsightsSection title="Where work waits">
        <FlowSkeleton stations={workStationCount(names)} />
      </InsightsSection>

      <ShippingSkeleton />

      <InsightsSection title="Pull requests">
        <PullRequestsSkeleton view={view} onView={onView} />
      </InsightsSection>
    </div>
  );
}
