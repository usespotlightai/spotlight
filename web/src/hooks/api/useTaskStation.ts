import { useLines } from '@/hooks/api/useLines';
import { useTask } from '@/hooks/api/useTasks';

export function useTaskStation(
  teamId: string | undefined,
  taskId: string | undefined,
) {
  const { data: task } = useTask(teamId, taskId);
  const { data: lines } = useLines(teamId);

  const stationId = task?.stationId;
  const line = lines?.find((each) =>
    each.stations.some((station) => station.id === stationId),
  );
  const station = line?.stations.find((each) => each.id === stationId);

  return { line, station, task };
}
