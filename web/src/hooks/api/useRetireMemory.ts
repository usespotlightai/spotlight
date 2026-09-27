import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runMemoryKeys } from '@/hooks/api/useRunMemories';
import { teamMemoryKeys } from '@/hooks/api/useTeamMemories';
import { retireMemory } from '@/lib/api';

type RetireMemoryInput = {
  teamId: string;
  memoryId: string;
  reason: string;
};

export function useRetireMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, memoryId, reason }: RetireMemoryInput) => {
      const { data } = await retireMemory({
        path: { teamId, memoryId },
        body: { reason },
        throwOnError: true,
      });
      return data;
    },

    onSuccess: (_retired, { teamId }) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: teamMemoryKeys.forTeam(teamId),
        }),
        queryClient.invalidateQueries({ queryKey: runMemoryKeys.all }),
      ]),
  });
}
