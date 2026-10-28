import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { WORTH_IMPROVING_HEADINGS, WORTH_IMPROVING_NOTE } from '@/lib/insights';

export function WorthImprovingSkeleton({ label }: { label?: string }) {
  return (
    <InsightsCardSkeleton
      label={label}
      tableOnly
      title="Worth improving"
      description={WORTH_IMPROVING_NOTE}
    >
      <NestedTableSkeleton
        label="Loading the station’s signals"
        headings={WORTH_IMPROVING_HEADINGS}
        compact
        trailing
        rowClassName="min-h-12"
      />
    </InsightsCardSkeleton>
  );
}
