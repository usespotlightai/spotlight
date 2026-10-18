import { InsightsCardSkeleton } from '@/components/features/insights/InsightsCardSkeleton';
import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import type { TileBones } from '@/lib/insights-tiles';
import { COVERAGE_PARTS, DISTRIBUTION_NOTE } from '@/lib/judge';

const TILES: readonly TileBones[] = [
  { label: null, detail: true },
  ...COVERAGE_PARTS.map(({ label }) => ({ label, detail: true })),
];

const CARDS = [
  { title: 'Statistics' },
  { title: 'Score comparison' },
  { title: 'Distribution', description: DISTRIBUTION_NOTE },
  { title: 'Trend over time' },
];

export function JudgeAgreementSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading how the judge agrees with people"
      className="flex flex-col gap-3"
    >
      <InsightsTilesSkeleton label="How far to trust the judge" tiles={TILES} />

      <div className="@container flex flex-col gap-2">
        <div className="grid auto-rows-[minmax(23rem,auto)] gap-2 @2xl:grid-cols-2 @6xl:grid-cols-4">
          {CARDS.map((card) => (
            <InsightsCardSkeleton key={card.title} {...card}>
              <div className="flex flex-1 items-center justify-center pb-8">
                <Skeleton className="size-40 rounded-md" />
              </div>
            </InsightsCardSkeleton>
          ))}
        </div>
      </div>
    </div>
  );
}
