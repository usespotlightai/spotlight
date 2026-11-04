import {
  SLICE_TITLE,
  sliceHeadings,
} from '@/components/features/insights/CostSlices';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';

export function CostSlicesSkeleton() {
  return (
    <InsightsCard
      flat
      title={SLICE_TITLE}
      actions={<Skeleton className="h-7 w-64 rounded-lg" />}
    >
      <NestedTableSkeleton
        label="Loading the spend"
        headings={sliceHeadings('Harness')}
        rows={4}
        compact
      />
    </InsightsCard>
  );
}
