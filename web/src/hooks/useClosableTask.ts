import { useTaskStation } from '@/hooks/api/useTaskStation';
import type {
  LineResponseDto,
  TaskResponseDto,
  StationResponseDto,
} from '@/lib/api';
import { mayLand } from '@/lib/task';

type ClosableTaskResult = {
  line: LineResponseDto;
  task: TaskResponseDto;
  completed: StationResponseDto;
} | null;

export function useClosableTask(
  teamId: string,
  taskId: string,
): ClosableTaskResult {
  const { line, task } = useTaskStation(teamId, taskId);
  const completed = line?.stations.find((each) => each.kind === 'completed');

  if (
    !line ||
    !task ||
    !completed ||
    !mayLand(line.stations, task, completed.id)
  ) {
    return null;
  }

  return { line, task, completed };
}

export type ClosableTask = NonNullable<ReturnType<typeof useClosableTask>>;
