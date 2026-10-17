import { SaidCard } from '@/components/features/inbox/conversation/SaidCard';
import { StationNameSkeleton } from '@/components/features/inbox/conversation/StationNameSkeleton';
import { TurnsSkeleton } from '@/components/features/inbox/conversation/TurnsSkeleton';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { ChatInputSkeleton } from '@/components/shared/chat-input/ChatInputSkeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { STICKY_AT_TOP } from '@/lib/inbox';

export function ConversationSkeleton() {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
          <SkeletonLine className="w-28 self-center text-xs" />

          <section className="flex flex-col">
            <div className={STICKY_AT_TOP}>
              <SaidCard>
                <StationNameSkeleton />

                <SkeletonLine className="w-2/5 text-sm leading-6" />
              </SaidCard>
            </div>

            <TurnsSkeleton />
          </section>
        </div>
      </div>

      <ComposerFooter>
        <ChatInputSkeleton placeholder="Reply…" />
      </ComposerFooter>
    </>
  );
}
