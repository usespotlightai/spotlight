import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { ImproveSection } from '@/components/features/stations/improve/ImproveSection';
import { WorthImprovingSkeleton } from '@/components/features/stations/improve/WorthImprovingSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { REPLAY_SET_HEADINGS, REPLAY_SETS_NOTE } from '@/lib/replay';
import { SEARCH_HEADINGS, SEARCHES_NOTE } from '@/lib/search';

export function StationImproveSkeleton() {
  return (
    <>
      <ImproveSection title="What needs attention">
        <WorthImprovingSkeleton />
      </ImproveSection>

      <ImproveSection title="Try a change">
        <div className="grid gap-3 lg:grid-cols-2">
          <InsightsCardSkeleton
            tableOnly
            label="Loading the replay set"
            title="Replay set"
            description={REPLAY_SETS_NOTE}
          >
            <NestedTableSkeleton
              label="Loading the replay set"
              headings={REPLAY_SET_HEADINGS}
              compact
            />
          </InsightsCardSkeleton>

          <InsightsCardSkeleton
            tableOnly
            label="Loading the searches"
            title="Searches"
            description={SEARCHES_NOTE}
          >
            <NestedTableSkeleton
              label="Loading the searches"
              headings={SEARCH_HEADINGS}
              compact
            />
          </InsightsCardSkeleton>
        </div>
      </ImproveSection>
    </>
  );
}
