import { useLines } from '@/hooks/api/useLines';
import { useTasks } from '@/hooks/api/useTasks';

export function useTaskStation(
  teamId: string | undefined,
  taskId: string | undefined,
) {
  const { data: tasks } = useTasks(teamId);
  const { data: lines } = useLines(teamId);

  const stationId = tasks?.find((each) => each.id === taskId)?.stationId;
  const line = lines?.find((each) =>
    each.stations.some((station) => station.id === stationId),
  );
  const station = line?.stations.find((each) => each.id === stationId);

  return { line, station };
}
