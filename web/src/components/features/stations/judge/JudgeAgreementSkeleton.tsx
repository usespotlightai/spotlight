import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';

export function JudgeAgreementSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading how the judge agrees with people"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton count={5} />
      <InsightsCardSkeleton rows={8} />
    </div>
  );
}
