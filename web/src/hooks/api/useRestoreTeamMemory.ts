import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { runMemoryKeys } from '@/hooks/api/useRunMemories';
import { teamMemoryKeys } from '@/hooks/api/useTeamMemories';
import { restoreTeamMemory, type TeamMemoryDetailResponseDto } from '@/lib/api';

type RestoreTeamMemoryInput = {
  teamId: string;
  memoryId: string;
};

export function useRestoreTeamMemory(): UseMutationResult<
  TeamMemoryDetailResponseDto,
  Error,
  RestoreTeamMemoryInput
> {
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
