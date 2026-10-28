import { MessageCard } from '@/components/features/inbox/conversation/MessageCard';
import { StationNameSkeleton } from '@/components/features/inbox/conversation/StationNameSkeleton';
import { TurnsSkeleton } from '@/components/features/inbox/conversation/TurnsSkeleton';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { ChatInputSkeleton } from '@/components/shared/chat-input/ChatInputSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { ScrollArea } from '@/components/ui/scroll-area';
import { STICKY_AT_TOP } from '@/lib/inbox';

export function ConversationSkeleton() {
  return (
    <>
      <ScrollArea className="min-h-0 flex-1" contentClassName="min-h-full">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
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
