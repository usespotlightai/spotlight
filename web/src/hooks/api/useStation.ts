import { useLines } from '@/hooks/api/useLines';

export function useStation(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
) {
  const lines = useLines(teamId);

  const line = lines.data?.find((candidate) => candidate.id === lineId);
  const station = line?.stations.find(
    (candidate) => candidate.id === stationId,
  );

  return { lines, line, station };
}
