import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { teamMemoryKeys } from '@/hooks/api/useTeamMemories';
import {
  editMemory,
  type WriteMemoryRequestDto,
  type TeamMemoryDetailResponseDto,
} from '@/lib/api';

type EditMemoryInput = {
  teamId: string;
  memoryId: string;
  memory: WriteMemoryRequestDto;
};

export function useEditMemory(): UseMutationResult<
  TeamMemoryDetailResponseDto,
  Error,
  EditMemoryInput
> {
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
