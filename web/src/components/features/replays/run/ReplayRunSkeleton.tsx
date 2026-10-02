import type { ReactNode } from 'react';
import { ReplayRunFooter } from '@/components/features/replays/run/ReplayRunFooter';
import { ChangesPanel } from '@/components/features/runs/ChangesPanel';
import { CrumbSeparator } from '@/components/shared/skeleton/CrumbSeparator';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';

type ReplayRunSkeletonProps = {
  footer?: ReactNode;
};

export function ReplayRunSkeleton({
  footer = <ReplayRunFooter />,
}: ReplayRunSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading the run"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader
        title={
          <>
            <Skeleton className="size-6 rounded" />
            <SkeletonLine className="w-20" />
            <CrumbSeparator />
            <SkeletonLine className="w-48" />
            <CrumbSeparator />
            <SkeletonLine className="w-28" />
          </>
        }
      />

      <ChangesPanel>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
            <SkeletonLine className="w-28 self-center text-xs" />

            <div className="mt-6 flex flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
              <SkeletonLine className="w-56" />
              <SkeletonLine className="w-40 text-xs" />
            </div>
          </div>
        </div>

        {footer}
      </ChangesPanel>
    </div>
  );
}
