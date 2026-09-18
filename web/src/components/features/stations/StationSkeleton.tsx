import { ChevronRight } from 'lucide-react';
import { ProposeChangesButton } from '@/components/features/stations/ProposeChangesButton';
import { StationLayout } from '@/components/features/stations/StationLayout';
import { StationPropertiesSkeleton } from '@/components/features/stations/StationPropertiesSkeleton';
import { RereadConfigurationButton } from '@/components/shared/RereadConfigurationButton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';

export function StationSkeleton({ teamId }: { teamId: string | undefined }) {
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
            <ChevronRight
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <SkeletonLine className="w-16" />
            <ChevronRight
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <SkeletonLine className="w-16" />
          </>
        }
        actions={
          <>
            <RereadConfigurationButton teamId={teamId} />
            <ProposeChangesButton disabled />
          </>
        }
      />

      <StationLayout aside={<StationPropertiesSkeleton />}>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <span className="mt-1 p-0.5">
              <Skeleton className="size-5 rounded-full" />
            </span>

            <SkeletonLine className="w-40 font-semibold text-2xl leading-8 tracking-tight" />
          </div>

          <SkeletonLine className="w-3/5 text-sm leading-6" />
        </div>

        <section className="flex flex-col gap-2">
          <header className="flex items-baseline gap-2">
            <h2 className="font-medium text-foreground text-sm">
              Agent prompt
            </h2>
          </header>

          <div className="min-h-48 w-full rounded-lg border-[0.5px] border-border bg-card p-3 text-sm leading-6">
            <SkeletonLine className="w-16" />
            <SkeletonLine className="w-2/3" />
            <SkeletonLine className="w-1/2" />
            <SkeletonLine className="w-3/5" />
          </div>
        </section>
      </StationLayout>
    </div>
  );
}
