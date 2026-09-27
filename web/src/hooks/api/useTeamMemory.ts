import { useQuery } from '@tanstack/react-query';
import { teamMemoryKeys } from '@/hooks/api/useTeamMemories';
import { readTeamMemory } from '@/lib/api';

export function useTeamMemory(teamId: string, memoryId: string) {
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
        throw new Error('Could not load the memory');
      }
      return data;
    },
  });
}
