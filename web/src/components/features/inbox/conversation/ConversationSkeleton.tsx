import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { StationNameSkeleton } from '@/components/features/inbox/conversation/StationNameSkeleton';
import { TurnsSkeleton } from '@/components/features/inbox/conversation/TurnsSkeleton';
import { ChatInputSkeleton } from '@/components/shared/chat-input/ChatInputSkeleton';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { THREAD_COLUMN } from '@/components/shared/thread-column';
import { ScrollArea } from '@/components/ui/scroll-area';
import { STICKY_AT_TOP } from '@/lib/inbox';
import { cn } from '@/lib/utils';

export function ConversationSkeleton() {
  return (
    <>
      <ScrollArea className="min-h-0 flex-1" contentClassName="min-h-full">
        <div className={cn(THREAD_COLUMN, 'flex flex-col')}>
          <SkeletonLine className="w-28 self-center text-xs" />

          <section className="flex flex-col">
            <div className={STICKY_AT_TOP}>
              <MessageCard>
                <StationNameSkeleton />

                <SkeletonLine className="w-2/5 text-sm leading-6" />
              </MessageCard>
            </div>

            <TurnsSkeleton />
          </section>
        </div>
      </ScrollArea>

      <ComposerFooter>
        <ChatInputSkeleton placeholder="Reply…" />
      </ComposerFooter>
    </>
  );
}
