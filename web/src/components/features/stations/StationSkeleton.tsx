import { StationImproveSkeleton } from '@/components/features/stations/improve/StationImproveSkeleton';
import { StationOverviewSkeleton } from '@/components/features/stations/overview/StationOverviewSkeleton';
import { StationPane } from '@/components/features/stations/StationPane';
import { CrumbSeparator } from '@/components/shared/skeleton/CrumbSeparator';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { STATION_TABS, type StationTab } from '@/lib/station';

const TAB_WIDTHS = {
  overview: 'w-14',
  improve: 'w-12',
} as const;

const BODIES = {
  overview: StationOverviewSkeleton,
  improve: StationImproveSkeleton,
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
        bordered={false}
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

      <div className="flex shrink-0 flex-col gap-4 pt-2">
        <div className="flex min-w-0 items-center gap-3 px-3">
          <Skeleton className="size-10 shrink-0 rounded-lg" />

          <div className="flex min-w-0 flex-col">
            <SkeletonLine className="w-44 font-semibold text-2xl leading-8 tracking-tight" />
            <SkeletonLine className="w-56 text-sm leading-5" />
          </div>
        </div>

        <div className="flex items-center gap-1 border-border border-b px-3">
          {STATION_TABS.map((each) => (
            <div key={each.id} className="flex h-9 items-center px-2">
              <SkeletonLine
                className={`${TAB_WIDTHS[each.id]} text-[0.8rem]`}
              />
            </div>
          ))}
        </div>
      </div>

      <StationPane>
        <Body />
      </StationPane>
    </div>
  );
}
