import { ChevronRight } from 'lucide-react';
import { ComposerSkeleton } from '@/components/features/inbox/conversation/ComposerSkeleton';
import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { StationNameSkeleton } from '@/components/features/inbox/conversation/StationNameSkeleton';
import { ChangesPanel } from '@/components/features/runs/ChangesPanel';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { HELD_AT_TOP } from '@/lib/inbox';

const CRUMB = (
  <ChevronRight
    className="size-3.5 shrink-0 text-muted-foreground"
    aria-hidden
  />
);

export function RunSkeleton() {
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
            {CRUMB}
            <SkeletonLine className="w-48" />
            {CRUMB}
            <SkeletonLine className="w-20" />
          </>
        }
      />

      <ChangesPanel>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
            <SkeletonLine className="w-28 self-center text-xs" />

            <section className="flex flex-col">
              <div className={HELD_AT_TOP}>
                <SaidCard>
                  <SkeletonLine className="w-3/5 text-sm leading-6" />
                </SaidCard>
              </div>

              <ol className="mt-6 flex flex-col gap-6">
                <li className="flex justify-center text-xs">
                  <SkeletonLine className="w-28" />
                </li>

                <li className="flex flex-col gap-1.5">
                  <StationNameSkeleton />

                  <div className="py-1.5">
                    <span className="flex items-center gap-1 py-0.5 text-muted-foreground text-xs">
                      <ChevronRight className="size-3" aria-hidden />
                      <SkeletonLine className="w-40" />
                    </span>
                  </div>

                  <SkeletonLine className="w-3/5 text-sm leading-6" />
                </li>
              </ol>
            </section>
          </div>
        </div>

        <ComposerFooter>
          <ComposerSkeleton placeholder="Say something…" />
        </ComposerFooter>
      </ChangesPanel>
    </div>
  );
}
