import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { ChatInputSkeleton } from '@/components/shared/chat-input/ChatInputSkeleton';
import { CrumbSeparator } from '@/components/shared/skeleton/CrumbSeparator';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { STICKY_AT_TOP } from '@/lib/inbox';

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
            <CrumbSeparator />
            <span className="whitespace-nowrap">Agent</span>
            <CrumbSeparator />
            <SkeletonLine className="w-48" />
          </>
        }
      />

      <ScrollArea className="min-h-0 flex-1" contentClassName="min-h-full flex">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-8 py-8">
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
