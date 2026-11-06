import { TaskRowSkeleton } from '@/components/features/board/task/TaskRowSkeleton';
import { ShowMore } from '@/components/shared/ShowMore';
import type { PagedList } from '@/hooks/api/usePagedList';

type CompletedTasksMoreProps = {
  list: PagedList<unknown>;
};

export function CompletedTasksMore({ list }: CompletedTasksMoreProps) {
  return (
    <ShowMore
      list={list}
      what="The completed tasks"
      skeleton={
        <ol role="status" aria-label="Loading the completed tasks">
          <TaskRowSkeleton />
        </ol>
      }
    />
  );
}
