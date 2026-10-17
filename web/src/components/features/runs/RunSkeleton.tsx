import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { TurnsSkeleton } from '@/components/features/inbox/conversation/TurnsSkeleton';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { ChatInputSkeleton } from '@/components/shared/chat-input/ChatInputSkeleton';
import { CrumbSeparator } from '@/components/shared/skeleton/CrumbSeparator';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { STICKY_AT_TOP } from '@/lib/inbox';

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
            <CrumbSeparator />
            <SkeletonLine className="w-48" />
            <CrumbSeparator />
            <SkeletonLine className="w-20" />
          </>
        }
      />

      <RunSidePanel>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
            <SkeletonLine className="w-28 self-center text-xs" />

            <section className="flex flex-col">
              <div className={STICKY_AT_TOP}>
                <MessageCard>
                  <SkeletonLine className="w-3/5 text-sm leading-6" />
                </MessageCard>
              </div>

              <TurnsSkeleton />
            </section>
          </div>
        </div>

        <ComposerFooter>
          <ChatInputSkeleton placeholder="Say something…" />
        </ComposerFooter>
      </RunSidePanel>
    </div>
  );
}
