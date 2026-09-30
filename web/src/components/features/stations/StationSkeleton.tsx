import { ChevronRight } from 'lucide-react';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { StationSection } from '@/components/features/stations/StationSection';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';

const CRUMB = (
  <ChevronRight
    className="size-3.5 shrink-0 text-muted-foreground"
    aria-hidden
  />
);

export function StationSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the station"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader
        title={
          <>
            <Skeleton className="size-6 rounded" />
            <SkeletonLine className="w-20" />
            {CRUMB}
            <SkeletonLine className="w-16" />
            {CRUMB}
            <SkeletonLine className="w-16" />
          </>
        }
      />

      <StationLayout>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <span className="mt-1 p-0.5">
              <Skeleton className="size-5 rounded-full" />
            </span>

            <SkeletonLine className="w-40 font-semibold text-2xl leading-8 tracking-tight" />
          </div>

          <div className="flex h-7 items-center gap-4 text-sm">
            <SkeletonLine className="w-24" />
            <SkeletonLine className="w-20" />
          </div>
        </div>

        <StationSection title="Agent prompt">
          <div className="w-full rounded-lg border-[0.5px] border-border bg-card p-3 text-sm leading-6">
            <SkeletonLine className="w-16" />
            <SkeletonLine className="w-2/3" />
          </div>
        </StationSection>
      </StationLayout>
    </div>
  );
}
