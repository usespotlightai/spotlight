import { useTaskStation } from '@/hooks/api/useTaskStation';
import { mayLand } from '@/lib/task';

export function useClosableTask(teamId: string, taskId: string) {
  const { line, task } = useTaskStation(teamId, taskId);
  const completed = line?.stations.find((each) => each.kind === 'completed');

  if (!line || !task || !completed || !mayLand(task, completed.id)) {
    return null;
  }

  return { line, task, completed };
}

export type ClosableTask = NonNullable<ReturnType<typeof useClosableTask>>;
