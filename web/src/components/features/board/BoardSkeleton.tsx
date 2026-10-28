import { StationSectionSkeleton } from '@/components/features/board/column/StationSectionSkeleton';
import { TaskRowSkeleton } from '@/components/features/board/task/TaskRowSkeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

export function BoardSkeleton() {
  return (
    <ScrollArea
      className="min-h-0 flex-1"
      role="status"
      aria-label="Loading the line"
      contentClassName="min-h-full flex flex-col gap-0.5 py-1.5"
    >
      <StationSectionSkeleton>
        <TaskRowSkeleton />
      </StationSectionSkeleton>
    </ScrollArea>
  );
}
