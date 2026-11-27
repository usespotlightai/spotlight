import type { UseQueryResult } from '@tanstack/react-query';

import { useLines } from '@/hooks/api/useLines';
import type { LineResponseDto, StationResponseDto } from '@/lib/api';

type StationOf = {
  readonly lines: UseQueryResult<LineResponseDto[]>;
  readonly line: LineResponseDto | undefined;
  readonly station: StationResponseDto | undefined;
};

export function useStation(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
): StationOf {
  const lines = useLines(teamId);

  const line = lines.data?.find((candidate) => candidate.id === lineId);
  const station = line?.stations.find(
    (candidate) => candidate.id === stationId,
  );

  return { lines, line, station };
}
