import { useLines } from '@/hooks/api/useLines';

export function useStation(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
) {
  const { data: lines, isPending } = useLines(teamId);

  const line = lines?.find((candidate) => candidate.id === lineId);
  const station = line?.stations.find(
    (candidate) => candidate.id === stationId,
  );

  return { line, station, isPending };
}
