import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamMemoryKeys } from '@/hooks/api/useTeamMemories';
import { type WriteMemoryRequestDto, writeMemory } from '@/lib/api';

type WriteMemoryInput = {
  teamId: string;
  memory: WriteMemoryRequestDto;
};

export function useWriteMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, memory }: WriteMemoryInput) => {
      const { data } = await writeMemory({
        path: { teamId },
        body: memory,
        throwOnError: true,
      });
      return data;
    },

    onSuccess: (_written, { teamId }) =>
      queryClient.invalidateQueries({
        queryKey: teamMemoryKeys.forTeam(teamId),
      }),
  });
}
