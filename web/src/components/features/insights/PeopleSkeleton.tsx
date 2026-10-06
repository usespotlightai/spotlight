import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';

export function PeopleSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the people"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton
        labels={[
          'Inbox asks per task',
          'Time to answer',
          'Sent-back rate',
          'Refused approvals',
        ]}
      />
      <InsightsTilesSkeleton
        labels={[
          'Active people',
          'New adopters',
          'Weekly active',
          'Monthly active',
        ]}
      />
      <InsightsCardSkeleton title="What each person did" rows={4} />
    </div>
  );
}
