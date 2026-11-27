import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { teamMemoryKeys } from '@/hooks/api/useTeamMemories';
import { readTeamMemory, type TeamMemoryDetailResponseDto } from '@/lib/api';

export function useTeamMemory(
  teamId: string,
  memoryId: string,
): UseQueryResult<TeamMemoryDetailResponseDto | null> {
  return useQuery({
    queryKey: teamMemoryKeys.one(teamId, memoryId),
    queryFn: async () => {
      const { data, response } = await readTeamMemory({
        path: { teamId, memoryId },
      });

      if (response?.status === 404) {
        return null;
      }
      if (!data) {
        throw new Error('Sorry, the memory couldn’t be loaded.');
      }
      return data;
    },
  });
}
