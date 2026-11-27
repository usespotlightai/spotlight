import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listTeamMemories, type TeamMemoryResponseDto } from '@/lib/api';
import type { MemoryFilter } from '@/lib/memory';
import { required } from '@/lib/required';

export const teamMemoryKeys = {
  forTeam: (teamId?: string) => ['team-memories', teamId ?? null] as const,
  listed: (teamId: string | undefined, filter: MemoryFilter) =>
    [...teamMemoryKeys.forTeam(teamId), 'listed', filter] as const,
  one: (teamId: string | undefined, memoryId: string) =>
    [...teamMemoryKeys.forTeam(teamId), 'one', memoryId] as const,
};

export function useTeamMemories(
  teamId: string | undefined,
  filter: MemoryFilter,
): UseQueryResult<TeamMemoryResponseDto[]> {
  return useQuery({
    queryKey: teamMemoryKeys.listed(teamId, filter),
    enabled: Boolean(teamId),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === teamId ? previous : undefined,
    queryFn: async () => {
      const { data } = await listTeamMemories({
        path: { teamId: required(teamId) },
        query: {
          status: filter.status,
          ...(filter.kind !== null && filter.kind !== ''
            ? { kind: filter.kind }
            : {}),
          ...(filter.lineId !== null && filter.lineId !== ''
            ? { lineId: filter.lineId }
            : {}),
          ...(filter.stationId !== null && filter.stationId !== ''
            ? { stationId: filter.stationId }
            : {}),
          ...(filter.repository !== null && filter.repository !== ''
            ? { repository: filter.repository }
            : {}),
          ...(filter.path !== null && filter.path !== ''
            ? { path: filter.path }
            : {}),
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
