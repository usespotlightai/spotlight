import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';

export function CandidatesSkeleton() {
  return (
    <div role="status" aria-label="Loading the candidates">
      <InsightsCardSkeleton rows={7} />
    </div>
  );
}
