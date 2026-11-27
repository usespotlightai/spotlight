import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listTeamMemories, type TeamMemoryResponseDto } from '@/lib/api';
import type { MemoryFilter } from '@/lib/memory';
import { nonEmpty } from '@/lib/non-empty';
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
          ...(nonEmpty(filter.kind) ? { kind: filter.kind } : {}),
          ...(nonEmpty(filter.lineId) ? { lineId: filter.lineId } : {}),
          ...(nonEmpty(filter.stationId)
            ? { stationId: filter.stationId }
            : {}),
          ...(nonEmpty(filter.repository)
            ? { repository: filter.repository }
            : {}),
          ...(nonEmpty(filter.path) ? { path: filter.path } : {}),
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
