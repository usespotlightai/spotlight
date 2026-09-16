import { ChevronRight } from 'lucide-react';
import { ComposerSkeleton } from '@/components/features/inbox/conversation/ComposerSkeleton';
import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { StationNameSkeleton } from '@/components/features/inbox/conversation/StationNameSkeleton';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { HELD_AT_TOP } from '@/lib/inbox';

export function ConversationSkeleton() {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
          <SkeletonLine className="w-28 self-center text-xs" />

          <section className="flex flex-col">
            <div className={HELD_AT_TOP}>
              <SaidCard>
                <StationNameSkeleton />

                <SkeletonLine className="w-2/5 text-sm leading-6" />
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
        <ComposerSkeleton placeholder="Reply…" />
      </ComposerFooter>
    </>
  );
}
