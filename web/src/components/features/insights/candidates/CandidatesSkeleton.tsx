import { ChartTableSwitch } from '@/components/features/insights/ChartTableSwitch';
import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { CANDIDATES_NOTE, candidateHeadings } from '@/lib/insights-candidates';
import { ignore } from '@/lib/utils';

export function CandidatesSkeleton() {
  return (
    <div role="status" aria-label="Loading the candidates">
      <InsightsCardSkeleton
        title="Replayed candidates"
        description={CANDIDATES_NOTE}
        actions={
          <div inert>
            <ChartTableSwitch tabled onTabled={ignore} />
          </div>
        }
      >
        <NestedTableSkeleton
          label="Loading the replayed candidates"
          headings={candidateHeadings(false)}
          rows={3}
          trailing
        />
      </InsightsCardSkeleton>
    </div>
  );
}
