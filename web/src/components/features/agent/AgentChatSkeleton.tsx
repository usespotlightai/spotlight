import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
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
            <span className="contents @max-[40rem]/pane:hidden">
              <Skeleton className="size-6 rounded" />
              <SkeletonLine className="w-20" />
              <CrumbSeparator />
            </span>
            <span className="whitespace-nowrap">Agent</span>
            <CrumbSeparator />
            <SkeletonLine className="w-48" />
          </>
        }
      />

      <ScrollArea className="min-h-0 flex-1" contentClassName="min-h-full flex">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className={cn(THREAD_COLUMN, 'flex flex-1 flex-col')}>
            <SkeletonLine className="w-28 self-center text-xs" />

            <section className="flex flex-col">
              <div className={STICKY_AT_TOP}>
                <div className="flex flex-col gap-1.5">
                  <MessageCard>
                    <SkeletonLine className="w-2/5 text-sm leading-6" />
                  </MessageCard>
                </div>
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 z-20">
            <ComposerFooter>
              <ChatInputSkeleton placeholder="Reply…" />
            </ComposerFooter>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
