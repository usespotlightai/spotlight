import { RunSidePanel } from '@/components/features/runs/RunSidePanel';
import { ComposerFooter } from '@/components/shared/ComposerFooter';
import { ChatInputSkeleton } from '@/components/shared/chat-input/ChatInputSkeleton';
import { CrumbSeparator } from '@/components/shared/skeleton/CrumbSeparator';
import { Skeleton } from '@/components/shared/skeleton/Skeleton';
import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RUNS_AUTONOMOUSLY } from '@/lib/run';

export function ReplayRunSkeleton() {
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
            <SkeletonLine className="w-28" />
          </>
        }
      />

      <RunSidePanel>
        <ScrollArea className="min-h-0 flex-1" contentClassName="min-h-full">
          <div className="mx-auto flex w-full max-w-3xl flex-col px-8 py-8">
            <SkeletonLine className="w-28 self-center text-xs" />

            <div className="mt-6 flex flex-col gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm">
              <SkeletonLine className="w-56" />
              <SkeletonLine className="w-40 text-xs" />
            </div>
          </div>
        </ScrollArea>

        <ComposerFooter>
          <ChatInputSkeleton placeholder={RUNS_AUTONOMOUSLY} />
        </ComposerFooter>
      </RunSidePanel>
    </div>
  );
}
