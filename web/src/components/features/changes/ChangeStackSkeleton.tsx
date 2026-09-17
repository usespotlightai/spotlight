import { STACK_NAV_PANE } from '@/components/features/changes/ChangeStackView';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { TrailSkeleton } from '@/components/shared/skeleton/TrailSkeleton';
import type { BreadcrumbSegment } from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { usePaneWidth } from '@/hooks/usePaneWidth';

const COHORTS = [
  ['w-40', 'w-32', 'w-44'],
  ['w-28', 'w-36'],
];

export function ChangeStackSkeleton({ known }: { known: BreadcrumbSegment[] }) {
  const { width } = usePaneWidth(STACK_NAV_PANE);

  return (
    <div
      role="status"
      aria-label="Loading the change stack"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader title={<TrailSkeleton known={known} />} />

      <div className="flex min-h-0 flex-1">
        <div
          style={{ width }}
          className="flex shrink-0 flex-col gap-8 border-border border-r-[0.5px] px-3 py-5"
        >
          {COHORTS.map((layers) => (
            <div key={layers.join()} className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-1 px-2 text-xs">
                <SkeletonLine className="w-32" />
                <SkeletonLine className="w-48" />
              </div>

              {layers.map((width) => (
                <div key={width} className="flex items-start gap-2.5 px-2 py-2">
                  <Skeleton className="size-5 rounded-full" />
                  <div className="flex flex-col text-sm">
                    <SkeletonLine className={width} />
                    <SkeletonLine className="w-12 text-xs" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-8 py-8">
          <div className="flex flex-col gap-2">
            <SkeletonLine className="w-40 text-xs" />
            <SkeletonLine className="w-2/5 text-lg" />
            <SkeletonLine className="w-4/5 text-sm" />
          </div>

          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
