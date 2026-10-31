import { StationPane } from '@/components/features/stations/StationPane';
import { StationTabSkeleton } from '@/components/features/stations/StationTabSkeleton';
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

      <StationPane>
        <StationTabSkeleton tab={tab} />
      </StationPane>
    </div>
  );
}
