import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { RowsSkeleton } from '@/components/features/replays/RowsSkeleton';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TrailSkeleton } from '@/components/shared/skeleton/TrailSkeleton';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import {
  HEALTH_LABEL,
  HEALTH_LINE_LABELS,
  HEALTH_NOTE,
} from '@/lib/replay-words';

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

        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="flex flex-wrap items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium text-foreground text-sm">
                {HEALTH_LABEL}
              </span>
              <p className="text-muted-foreground text-xs leading-5">
                {HEALTH_NOTE}
              </p>
            </div>
            <Skeleton className="h-7 w-32 rounded-full" />
            <Skeleton className="h-7 w-40 rounded-full" />
          </div>
          <div className="flex flex-col">
            {HEALTH_LINE_LABELS.map((line) => (
              <div
                key={line}
                className="flex flex-col gap-1 border-border border-t py-2 first:border-t-0 first:pt-0 last:pb-0"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 text-xs">
                  <span className="font-medium text-foreground sm:w-44 sm:shrink-0">
                    {line}
                  </span>
                  <SkeletonLine className="w-32 text-xs" />
                  <SkeletonLine className="ml-auto w-16 text-xs" />
                </div>
                <SkeletonLine className="w-80 max-w-full text-xs leading-5 sm:ml-47" />
              </div>
            ))}
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <ReplaysHeading title="Replays" level="h2" />
          <RowsSkeleton label="Loading the replays" />
        </section>

        <section className="flex flex-col gap-2">
          <ReplaysHeading title="Runs" level="h2" />
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5">
            <SkeletonLine className="w-48 text-xs" />
            <Skeleton className="h-2 w-full rounded-full" />
            <SkeletonLine className="w-64 text-xs" />
          </div>
          <RowsSkeleton label="Loading the runs" />
        </section>
      </StationLayout>
    </div>
  );
}
