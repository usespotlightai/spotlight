import { InsightsTableCardSkeleton } from '@/components/features/insights/InsightsTableCardSkeleton';
import { InsightsTileSkeleton } from '@/components/features/insights/InsightsTileSkeleton';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { StationPane } from '@/components/features/stations/StationPane';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TrailSkeleton } from '@/components/shared/skeleton/TrailSkeleton';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';

const TILES = ['Best', 'Live config', 'Iterations', 'Tasks', 'Spent'];

type SearchSkeletonProps = {
  known: readonly BreadcrumbSegment[];
};

export function SearchSkeleton({ known }: SearchSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading the search"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader bordered={false} title={<TrailSkeleton known={known} />} />

      <div className="flex shrink-0 items-center gap-3 px-3 pt-2 pb-1">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-col">
          <SkeletonLine className="w-32 font-semibold text-2xl leading-8 tracking-tight" />
          <SkeletonLine className="w-56 text-sm leading-5" />
        </div>
      </div>

      <StationPane>
        <InsightsTiles label="Loading the search in numbers" className="gap-3">
          {TILES.map((label) => (
            <InsightsTileSkeleton key={label} label={label} detail />
          ))}
        </InsightsTiles>
        <InsightsTableCardSkeleton rows={5} />
      </StationPane>
    </div>
  );
}
