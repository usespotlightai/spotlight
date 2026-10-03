import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { RowsSkeleton } from '@/components/features/replays/RowsSkeleton';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TrailSkeleton } from '@/components/shared/skeleton/TrailSkeleton';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';

type ReplaySetSkeletonProps = {
  known: readonly BreadcrumbSegment[];
};

export function ReplaySetSkeleton({ known }: ReplaySetSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading the replay set"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader title={<TrailSkeleton known={known} />} />

      <StationLayout>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start gap-2">
            <SkeletonLine className="w-40 font-semibold text-2xl leading-8 tracking-tight" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="h-7 w-16 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-md" />
            </div>
          </div>
          <SkeletonLine className="w-24 text-xs" />
        </div>

        <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="flex items-center gap-2">
            <SkeletonLine className="w-40 text-xs" />
            <Skeleton className="ml-auto h-7 w-28 rounded-full" />
          </div>
          <SkeletonLine className="w-64 text-xs" />
        </div>

        <section className="flex flex-col gap-2">
          <ReplaysHeading title="Replays" level="h2" />
          <RowsSkeleton label="Loading the replays" />
        </section>

        <section className="flex flex-col gap-2">
          <ReplaysHeading title="Runs" level="h2" />
          <RowsSkeleton label="Loading the runs" />
        </section>
      </StationLayout>
    </div>
  );
}
