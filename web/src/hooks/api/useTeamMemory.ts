import { useQuery } from '@tanstack/react-query';
import { teamMemoryKeys } from '@/hooks/api/useTeamMemories';
import { readTeamMemory } from '@/lib/api';

export function useTeamMemory(teamId: string, memoryId: string) {
  return useQuery({
    queryKey: teamMemoryKeys.one(teamId, memoryId),
    queryFn: async () => {
      const { data } = await readTeamMemory({
        path: { teamId, memoryId },
        throwOnError: true,
      });
      return data;
    },
  });
}
