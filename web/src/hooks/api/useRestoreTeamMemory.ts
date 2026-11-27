import { useMutation, useQueryClient } from '@tanstack/react-query';

import { runMemoryKeys } from '@/hooks/api/useRunMemories';
import { teamMemoryKeys } from '@/hooks/api/useTeamMemories';
import { restoreTeamMemory } from '@/lib/api';

type RestoreTeamMemoryInput = {
  teamId: string;
  memoryId: string;
};

export function useRestoreTeamMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, memoryId }: RestoreTeamMemoryInput) => {
      const { data } = await restoreTeamMemory({
        path: { teamId, memoryId },
        throwOnError: true,
      });
      return data;
    },

    onSuccess: (_restored, { teamId }) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: teamMemoryKeys.forTeam(teamId),
        }),
        queryClient.invalidateQueries({ queryKey: runMemoryKeys.all }),
      ]),
  });
}
