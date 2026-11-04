import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import {
  OVERVIEW_LAYOUT,
  TILE_ROW,
} from '@/components/features/insights/overview-layout';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { PEOPLE_HEADINGS } from '@/lib/insights';
import type { TileBones } from '@/lib/insights-tiles';

const LOAD: readonly TileBones[] = [
  { label: 'Asks per task', delta: true, detail: true },
  { label: 'Time to answer', delta: true, detail: true },
  { label: 'Sent-back rate', delta: true, detail: true },
  { label: 'Dismissed', delta: true },
];

export function PeopleSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the people"
      className={OVERVIEW_LAYOUT}
    >
      <InsightsSection title="What the work asks of people">
        <InsightsTilesSkeleton
          label="Human load"
          tiles={LOAD}
          className={TILE_ROW}
        />
      </InsightsSection>

      <InsightsSection title="Who is using Spotlight">
        <NestedTableSkeleton
          label="Loading what each person did"
          headings={PEOPLE_HEADINGS}
          compact
        />
      </InsightsSection>
    </div>
  );
}
