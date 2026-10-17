import { Plus } from 'lucide-react';
import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { ImproveSection } from '@/components/features/stations/improve/ImproveSection';
import { WorthImprovingSkeleton } from '@/components/features/stations/improve/WorthImprovingSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { PanelActions } from '@/components/shared/PanelActions';
import { ButtonSkeleton } from '@/components/shared/skeleton/ButtonSkeleton';
import { REPLAY_SET_HEADINGS, REPLAY_SETS_NOTE } from '@/lib/replay';
import { SEARCH_HEADINGS, SEARCHES_NOTE } from '@/lib/search';

export function StationImproveSkeleton() {
  return (
    <>
      <ImproveSection title="What stands out">
        <WorthImprovingSkeleton />
      </ImproveSection>

      <ImproveSection title="Try a change">
        <div className="grid gap-3 lg:grid-cols-2">
          <InsightsCardSkeleton
            tableOnly
            label="Loading the replay sets"
            title="Replay sets"
            description={REPLAY_SETS_NOTE}
          >
            <NestedTableSkeleton
              label="Loading the replay sets"
              headings={REPLAY_SET_HEADINGS}
              compact
            />
            <PanelActions>
              <ButtonSkeleton>
                <Plus aria-hidden />
                Create a replay set
              </ButtonSkeleton>
            </PanelActions>
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
            <PanelActions>
              <ButtonSkeleton>Start a search</ButtonSkeleton>
            </PanelActions>
          </InsightsCardSkeleton>
        </div>
      </ImproveSection>
    </>
  );
}
