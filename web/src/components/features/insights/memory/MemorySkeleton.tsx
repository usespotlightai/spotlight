import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import {
  FLAGGED_HEADINGS,
  FLAGGED_NOTE,
  MEMORY_COMPARISON_HEADINGS,
  MEMORY_COMPARISON_NOTE,
} from '@/lib/insights-memory';
import type { TileBones } from '@/lib/insights-tiles';

const TILES: readonly TileBones[] = [
  { label: 'Standing memories', detail: 'Kept by the team now' },
  { label: 'Briefed', detail: true },
  { label: 'Read', detail: true },
  { label: 'Flagged wrong', detail: 'Retired by people in this period' },
  { label: 'Solved with memories', detail: true },
];

export function MemorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the memory"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton label="Memory use" tiles={TILES} />

      <InsightsCardSkeleton
        tableOnly
        title="Runs with memories and without"
        description={MEMORY_COMPARISON_NOTE}
      >
        <NestedTableSkeleton
          label="Loading runs with memories and without"
          headings={MEMORY_COMPARISON_HEADINGS}
          rows={7}
          rowClassName="py-2"
        />
      </InsightsCardSkeleton>

      <InsightsCardSkeleton title="Flagged wrong" description={FLAGGED_NOTE}>
        <NestedTableSkeleton
          label="Loading the memories flagged wrong"
          headings={FLAGGED_HEADINGS}
          rows={1}
          rowClassName="min-h-12"
        />
      </InsightsCardSkeleton>
    </div>
  );
}
