import { StationSectionSkeleton } from '@/components/features/board/column/StationSectionSkeleton';
import { TaskRowSkeleton } from '@/components/features/board/task/TaskRowSkeleton';

export function BoardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading the line"
      className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto py-1.5"
    >
      <StationSectionSkeleton>
        <TaskRowSkeleton />
      </StationSectionSkeleton>
    </div>
  );
}
