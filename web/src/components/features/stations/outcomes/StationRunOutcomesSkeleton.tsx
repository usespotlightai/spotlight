import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { OUTCOME_HEADINGS } from '@/lib/station-insights';

export function StationRunOutcomesSkeleton() {
  return (
    <NestedTableSkeleton
      label="Loading how its runs turned out"
      headings={OUTCOME_HEADINGS}
      rows={4}
      trailing
    />
  );
}
