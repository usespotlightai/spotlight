import {
  queryOptions,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { SharedQuery } from '@/hooks/api/sharedQuery';
import { listTeamLines, type LineResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

export const lineKeys = {
  forTeam: (teamId?: string) => ['lines', teamId ?? null] as const,
};

export const linesQuery = (
  teamId: string | undefined,
): SharedQuery<LineResponseDto[], ReturnType<typeof lineKeys.forTeam>> =>
  queryOptions({
    queryKey: lineKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listTeamLines({
        path: { teamId: required(teamId) },
        throwOnError: true,
      });
      return data;
    },
  });

export function useLines(
  teamId: string | undefined,
  enabled = true,
): UseQueryResult<LineResponseDto[]> {
  return useQuery({
    ...linesQuery(teamId),
    enabled: enabled && Boolean(teamId),
  });
}
