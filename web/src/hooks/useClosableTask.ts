import { useTaskStation } from '@/hooks/api/useTaskStation';
import { useMe } from '@/hooks/useMe';
import { mayLand } from '@/lib/task';

export function useClosableTask(teamId: string, taskId: string) {
  const me = useMe();
  const { line, task } = useTaskStation(teamId, taskId);
  const completed = line?.stations.find((each) => each.kind === 'completed');

  if (
    !line ||
    !task ||
    !completed ||
    !mayLand(line.stations, task, completed.id, me?.id)
  ) {
    return null;
  }

  return { line, task, completed };
}

export type ClosableTask = NonNullable<ReturnType<typeof useClosableTask>>;
