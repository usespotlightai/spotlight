import { OpenInEditorSkeleton } from '@/components/features/editor/OpenInEditorSkeleton';
import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { TurnsSkeleton } from '@/components/features/inbox/conversation/TurnsSkeleton';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { ChatInputSkeleton } from '@/components/shared/chat-input/ChatInputSkeleton';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { CrumbSeparator } from '@/components/shared/skeleton/CrumbSeparator';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { THREAD_COLUMN } from '@/components/shared/thread-column';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { STICKY_AT_TOP } from '@/lib/inbox';
import { cn } from '@/lib/utils';

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
            <SkeletonLine className="w-24 @xl/pane:w-48" />
            <CrumbSeparator />
            <SkeletonLine className="w-20" />
          </>
        }
        actions={<OpenInEditorSkeleton />}
      />

      <RunSidePanel>
        <ScrollArea className="min-h-0 flex-1" contentClassName="min-h-full">
          <div className={cn(THREAD_COLUMN, 'flex flex-col')}>
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
        </ScrollArea>

        <ComposerFooter>
          <ChatInputSkeleton placeholder="Write a message…" />
        </ComposerFooter>
      </RunSidePanel>
    </div>
  );
}
