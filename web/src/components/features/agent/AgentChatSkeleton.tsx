import { ChevronRight } from 'lucide-react';
import { ComposerSkeleton } from '@/components/features/inbox/conversation/ComposerSkeleton';
import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
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

export function AgentChatSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the chat"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader
        title={
          <>
            <Skeleton className="size-6 rounded" />
            <SkeletonLine className="w-20" />
            {CRUMB}
            <span className="whitespace-nowrap">Agent</span>
            {CRUMB}
            <SkeletonLine className="w-48" />
          </>
        }
      />

      <div className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-8 py-8">
            <SkeletonLine className="w-28 self-center text-xs" />

            <section className="flex flex-col">
              <div className={HELD_AT_TOP}>
                <div className="flex flex-col gap-1.5">
                  <SaidCard>
                    <SkeletonLine className="w-2/5 text-sm leading-6" />
                  </SaidCard>
                </div>
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 z-20">
            <ComposerFooter>
              <ComposerSkeleton placeholder="Reply…" />
            </ComposerFooter>
          </div>
        </div>
      </div>
    </div>
  );
}
