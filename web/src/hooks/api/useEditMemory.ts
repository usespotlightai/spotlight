import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamMemoryKeys } from '@/hooks/api/useTeamMemories';
import { editMemory, type WriteMemoryRequestDto } from '@/lib/api';

type EditMemoryInput = {
  teamId: string;
  memoryId: string;
  memory: WriteMemoryRequestDto;
};

export function useEditMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, memoryId, memory }: EditMemoryInput) => {
      const { data } = await editMemory({
        path: { teamId, memoryId },
        body: memory,
        throwOnError: true,
      });
      return data;
    },

    onSuccess: (_edited, { teamId }) =>
      queryClient.invalidateQueries({
        queryKey: teamMemoryKeys.forTeam(teamId),
      }),
  });
}
