import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { OVERVIEW_LAYOUT } from '@/components/features/insights/overview-layout';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import {
  FLAGGED_HEADINGS,
  FLAGGED_NOTE,
  MEMORY_COMPARISON_HEADINGS,
  MEMORY_COMPARISON_NOTE,
  MEMORY_COMPARISON_TITLE,
} from '@/lib/insights-memory';
import type { TileBones } from '@/lib/insights-tiles';

const TILES: readonly TileBones[] = [
  { label: 'Active memories', detail: 'Approved by the team' },
  { label: 'Briefed', detail: true },
  { label: 'Recalled', detail: true },
  { label: 'Solved with memories', detail: true },
];

export function MemorySkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the memory"
      className={OVERVIEW_LAYOUT}
    >
      <InsightsTilesSkeleton label="Memory use" tiles={TILES} />

      <InsightsCardSkeleton
        flat
        tableOnly
        title={MEMORY_COMPARISON_TITLE}
        description={MEMORY_COMPARISON_NOTE}
      >
        <NestedTableSkeleton
          label="Loading runs with memories and without"
          headings={MEMORY_COMPARISON_HEADINGS}
          rows={7}
          rowClassName="py-2"
        />
      </InsightsCardSkeleton>

      <InsightsCardSkeleton
        flat
        tableOnly
        title="Flagged wrong"
        description={FLAGGED_NOTE}
      >
        <NestedTableSkeleton
          label="Loading the memories flagged wrong"
          headings={FLAGGED_HEADINGS}
          rows={1}
          rowClassName="py-2"
        />
      </InsightsCardSkeleton>
    </div>
  );
}
