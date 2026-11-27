import { useCompletedTasks, useTasks } from '@/hooks/api/useTasks';
import type { TaskResponseDto } from '@/lib/api';
import type { BoardView } from '@/lib/board';

type BoardTasksResult = {
  tasks: ReturnType<typeof useTasks>;
  completed: ReturnType<typeof useCompletedTasks>;
  shown: TaskResponseDto[];
};

export function useBoardTasks(
  teamId: string | undefined,
  lineId: string | undefined,
  view: BoardView,
): BoardTasksResult {
  const tasks = useTasks(teamId);
  const completed = useCompletedTasks(teamId, lineId, view === 'completed');
  const open = tasks.data ?? [];
  const shown = [
    ...open,
    ...(completed.data ?? []).filter(
      (task) => !open.some((each) => each.id === task.id),
    ),
  ];

  return { tasks, completed, shown };
}
