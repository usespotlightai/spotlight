import { ChevronRight } from 'lucide-react';
import { ConversationSkeleton } from '@/components/features/inbox/conversation/ConversationSkeleton';
import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';

export function InboxItemSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the conversation"
      className="flex min-h-0 flex-1 flex-col"
    >
      <PageHeader
        title={
          <>
            <Skeleton className="size-6 rounded" />
            <SkeletonLine className="w-20" />
            <ChevronRight
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <SkeletonLine className="w-48" />
          </>
        }
      />

      <RunSidePanel>
        <ConversationSkeleton />
      </RunSidePanel>
    </div>
  );
}
