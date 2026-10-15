import { MoreHorizontal } from 'lucide-react';
import { StationIconSkeleton } from '@/components/features/board/column/StationIconSkeleton';
import { RunRowSkeleton } from '@/components/features/runs/RunRowSkeleton';
import { PropertySkeleton } from '@/components/shared/skeleton/PropertySkeleton';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TrailSkeleton } from '@/components/shared/skeleton/TrailSkeleton';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';

const DESCRIPTION = ['w-full', 'w-11/12', 'w-4/5', 'w-3/5'];
const ACTIVITY = 3;

export function TaskSkeleton({
  known,
}: {
  known: readonly BreadcrumbSegment[];
}) {
  return (
    <div
      role="status"
      aria-label="Loading the task"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader
        title={<TrailSkeleton known={known} />}
        trailing={
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground"
          >
            <MoreHorizontal className="size-4" />
          </span>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-5xl gap-10 px-8 py-8">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <SkeletonLine className="w-2/5 font-semibold text-2xl leading-8 tracking-tight" />

            <div className="text-sm leading-6">
              {DESCRIPTION.map((width) => (
                <SkeletonLine key={width} className={width} />
              ))}
            </div>

            <div className="pt-4">
              <section className="flex flex-col gap-3 border-border border-t pt-6">
                <h2 className="font-semibold text-foreground text-sm">
                  Activity
                </h2>

                <ul className="flex flex-col gap-0.5">
                  {Array.from({ length: ACTIVITY }, (_, at) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the placeholders are fixed and their order does not change
                    <RunRowSkeleton key={at} />
                  ))}
                </ul>
              </section>
            </div>
          </div>

          <div className="sticky top-8 hidden w-56 shrink-0 flex-col gap-4 self-start lg:flex">
            <section className="flex flex-col gap-1.5">
              <h2 className="px-2 font-medium text-muted-foreground text-xs">
                Properties
              </h2>

              <PropertySkeleton lead={<StationIconSkeleton />} width="w-24" />

              <PropertySkeleton
                lead={<Skeleton className="size-4 rounded-full" />}
                width="w-20"
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
