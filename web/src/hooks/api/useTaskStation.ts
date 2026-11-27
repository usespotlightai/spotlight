import { useLines } from '@/hooks/api/useLines';
import { useTask } from '@/hooks/api/useTasks';
import type {
  LineResponseDto,
  StationResponseDto,
  TaskResponseDto,
} from '@/lib/api';

type TaskStation = {
  readonly line: LineResponseDto | undefined;
  readonly station: StationResponseDto | undefined;
  readonly task: TaskResponseDto | undefined;
};

export function useTaskStation(
  teamId: string | undefined,
  taskId: string | undefined,
): TaskStation {
  const { data: task } = useTask(teamId, taskId);
  const { data: lines } = useLines(teamId);

  const stationId = task?.stationId;
  const line = lines?.find((each) =>
    each.stations.some((station) => station.id === stationId),
  );
  const station = line?.stations.find((each) => each.id === stationId);

  return { line, station, task };
}
