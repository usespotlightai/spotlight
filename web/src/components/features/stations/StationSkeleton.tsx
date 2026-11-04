import { StationPane } from '@/components/features/stations/StationPane';
import { StationTabSkeleton } from '@/components/features/stations/StationTabSkeleton';
import { STATION_COLUMN } from '@/components/features/stations/station-column';
import { CrumbSeparator } from '@/components/shared/skeleton/CrumbSeparator';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { STATION_TABS, type StationTab } from '@/lib/station';
import { cn } from '@/lib/utils';

export function StationSkeleton({ tab }: { tab: StationTab }) {
  return (
    <div
      role="status"
      aria-label="Loading the station"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader
        bordered={false}
        heading={false}
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

      <div className="flex shrink-0 flex-col gap-3 pt-3">
        <div className={cn(STATION_COLUMN, 'flex min-w-0 flex-col gap-1')}>
          <span className="flex items-center gap-2.5 text-xl leading-7">
            <Skeleton className="size-[1.125rem] shrink-0 rounded-full" />
            <SkeletonLine className="w-44" />
          </span>
          <SkeletonLine className="w-56 text-sm leading-5" />
        </div>

        <div className="border-border border-b">
          <div className={cn(STATION_COLUMN, 'flex items-center gap-1 pl-1')}>
            {STATION_TABS.map((each) => (
              <span
                key={each.id}
                className={cn(
                  'relative flex h-9 items-center px-2 text-[0.8rem]',
                  each.id === tab ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {each.label}
                {each.id === tab && (
                  <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-primary" />
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      <StationPane>
        <StationTabSkeleton tab={tab} />
      </StationPane>
    </div>
  );
}
