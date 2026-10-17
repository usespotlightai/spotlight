import type { ReactNode } from 'react';
import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { INSIGHTS_RUN_HEADINGS, INSIGHTS_RUNS_NOTE } from '@/lib/insights';

export function RunsSkeleton({ filters }: { filters: ReactNode }) {
  return (
    <InsightsCardSkeleton
      label="Loading the runs"
      tableOnly
      title="Runs"
      description={INSIGHTS_RUNS_NOTE}
      actions={filters}
    >
      <NestedTableSkeleton
        label="Loading the runs"
        headings={INSIGHTS_RUN_HEADINGS}
        rows={20}
        rowClassName="py-2"
      />
    </InsightsCardSkeleton>
  );
}
