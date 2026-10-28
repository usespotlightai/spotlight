import { ImproveCardSkeleton } from '@/components/features/stations/improve/ImproveCardSkeleton';
import { StationPane } from '@/components/features/stations/StationPane';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TrailSkeleton } from '@/components/shared/skeleton/TrailSkeleton';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { HEALTH_LINE_LABELS, REPLAY_SET_TITLE } from '@/lib/replay-words';

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
      <PageHeader bordered={false} title={<TrailSkeleton known={known} />} />

      <div className="flex shrink-0 items-center gap-3 px-3 pt-2 pb-1">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-semibold text-2xl text-foreground leading-8 tracking-tight">
            {REPLAY_SET_TITLE}
          </h1>
          <SkeletonLine className="w-28 text-sm leading-5" />
        </div>
      </div>

      <StationPane>
        <ImproveCardSkeleton label="Loading the replays" rows={3} />
        <ImproveCardSkeleton
          label="Loading the health"
          rows={HEALTH_LINE_LABELS.length}
        />
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <ImproveCardSkeleton label="Loading the runs" rows={5} />
          <ImproveCardSkeleton label="Loading the checks" rows={3} />
        </div>
      </StationPane>
    </div>
  );
}
