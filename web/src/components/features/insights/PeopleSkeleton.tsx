import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsSection } from '@/components/features/insights/InsightsSection';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { NestedTableSkeleton } from '@/components/shared/nested-table/NestedTableSkeleton';
import { ADOPTION_NOTE, PEOPLE_HEADINGS } from '@/lib/insights';
import type { TileBones } from '@/lib/insights-tiles';

const LOAD: readonly TileBones[] = [
  { label: 'Inbox asks per task', delta: true, detail: true },
  { label: 'Time to answer', delta: true, detail: true },
  { label: 'Sent-back rate', delta: true, detail: true },
  {
    label: 'Refused approvals',
    delta: true,
    detail: 'Tool approvals and permissions',
  },
];

const ADOPTION: readonly TileBones[] = [
  { label: 'Active people', delta: true },
  { label: 'New adopters' },
  { label: 'Weekly active' },
  { label: 'Monthly active', detail: true },
];

export function PeopleSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the people"
      className="flex flex-col gap-3"
    >
      <InsightsSection title="What the work asks of people">
        <InsightsTilesSkeleton label="Human load" tiles={LOAD} />
      </InsightsSection>

      <InsightsSection title="Who is using Spotlight" note={ADOPTION_NOTE}>
        <InsightsTilesSkeleton label="Adoption" tiles={ADOPTION} />
      </InsightsSection>

      <InsightsCardSkeleton title="What each person did" tableOnly>
        <NestedTableSkeleton
          label="Loading what each person did"
          headings={PEOPLE_HEADINGS}
          rowClassName="py-2"
        />
      </InsightsCardSkeleton>
    </div>
  );
}
