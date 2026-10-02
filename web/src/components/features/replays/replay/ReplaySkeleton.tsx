import { ReplaysHeading } from '@/components/features/replays/ReplaysHeading';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TrailSkeleton } from '@/components/shared/skeleton/TrailSkeleton';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';

type ReplaySkeletonProps = {
  known: readonly BreadcrumbSegment[];
};

export function ReplaySkeleton({ known }: ReplaySkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading the replay"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader title={<TrailSkeleton known={known} />} />

      <StationLayout>
        <div className="flex flex-col gap-3">
          <SkeletonLine className="w-40 font-semibold text-2xl leading-8 tracking-tight" />
          <SkeletonLine className="w-48 text-xs" />
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
            <span className="text-muted-foreground text-xs">Success</span>
            <SkeletonLine className="w-28 text-xs" />
            <span className="text-muted-foreground text-xs">Scored</span>
            <SkeletonLine className="w-24 text-xs" />
            <span className="text-muted-foreground text-xs">Spent</span>
            <SkeletonLine className="w-20 text-xs" />
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <ReplaysHeading title="Task by task" level="h2" />
          <SkeletonLine className="w-full text-xs" />
        </section>
      </StationLayout>
    </div>
  );
}
