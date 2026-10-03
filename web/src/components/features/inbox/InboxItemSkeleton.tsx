import { ConversationSkeleton } from '@/components/features/inbox/conversation/ConversationSkeleton';
import { InboxHeaderSkeleton } from '@/components/features/inbox/InboxHeaderSkeleton';
import { ChangesPanel } from '@/components/features/runs/ChangesPanel';

export function InboxItemSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the conversation"
      className="flex min-h-0 flex-1 flex-col"
    >
      <InboxHeaderSkeleton />

      <ChangesPanel>
        <ConversationSkeleton />
      </ChangesPanel>
    </div>
  );
}
