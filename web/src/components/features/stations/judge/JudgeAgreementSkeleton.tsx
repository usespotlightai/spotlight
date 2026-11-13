import { InsightsTilesSkeleton } from '@/components/features/insights/InsightsTilesSkeleton';
import {
  DETAILS_GRID,
  SUBSECTIONS,
} from '@/components/features/stations/judge/layout';
import { TabSection } from '@/components/features/stations/TabSection';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import {
  CONFUSION_TITLE,
  COVERAGE_PARTS,
  COVERAGE_SKELETON_TITLE,
  TREND_TITLE,
} from '@/lib/judge';

const TILES = [
  { label: 'Runs both scored', detail: true },
  { label: null, detail: true },
  { label: null, detail: true },
  { label: null },
];

export function JudgeAgreementSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading how the judge agrees with people"
      className="@container flex flex-col gap-10"
    >
      <TabSection title="Agreement with people">
        <span className="flex items-start gap-2 text-sm leading-5">
          <Skeleton className="mt-0.5 size-4 rounded-full" />
          <SkeletonLine className="w-40" />
        </span>
        <InsightsTilesSkeleton label="Agreement with people" tiles={TILES} />
        <div className={SUBSECTIONS}>
          <div className={DETAILS_GRID}>
            <TabSection level={3} title={CONFUSION_TITLE}>
              <Skeleton className="size-44 rounded-md" />
            </TabSection>
            <TabSection level={3} title={TREND_TITLE}>
              <Skeleton className="h-44 w-full rounded-md" />
            </TabSection>
          </div>
          <TabSection level={3} title={COVERAGE_SKELETON_TITLE}>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-2 w-full rounded-full" />
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 @xl/pane:grid-cols-4">
                {COVERAGE_PARTS.map((part) => (
                  <div key={part.key} className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground text-xs">
                      {part.label}
                    </span>
                    <SkeletonLine className="w-12 text-sm" />
                  </div>
                ))}
              </div>
            </div>
          </TabSection>
        </div>
      </TabSection>
    </div>
  );
}
