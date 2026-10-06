import { StationConfigSkeleton } from '@/components/features/stations/config/StationConfigSkeleton';
import { StationImproveSkeleton } from '@/components/features/stations/improve/StationImproveSkeleton';
import { StationOverviewSkeleton } from '@/components/features/stations/overview/StationOverviewSkeleton';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { CrumbSeparator } from '@/components/shared/skeleton/CrumbSeparator';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { STATION_TABS, type StationTab } from '@/lib/station';
import { cn } from '@/lib/utils';

const TAB_WIDTHS = {
  overview: 'w-[4.5rem]',
  improve: 'w-16',
  config: 'w-16',
} as const;

const BODIES = {
  overview: StationOverviewSkeleton,
  improve: StationImproveSkeleton,
  config: StationConfigSkeleton,
} as const;

export function StationSkeleton({ tab }: { tab: StationTab }) {
  const Body = BODIES[tab];

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
            <CrumbSeparator />
            <SkeletonLine className="w-16" />
            <CrumbSeparator />
            <SkeletonLine className="w-16" />
          </>
        }
      />

      <StationLayout>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <span className="mt-1 p-0.5">
                <Skeleton className="size-5 rounded-full" />
              </span>

              <SkeletonLine className="w-40 font-semibold text-2xl leading-8 tracking-tight" />
            </div>

            <SkeletonLine className="w-48 text-sm" />
          </div>

          <div className="flex items-center gap-1">
            {STATION_TABS.map((each) => (
              <Skeleton
                key={each.id}
                className={cn('h-7 rounded-full', TAB_WIDTHS[each.id])}
              />
            ))}
          </div>
        </div>

        <Body />
      </StationLayout>
    </div>
  );
}
