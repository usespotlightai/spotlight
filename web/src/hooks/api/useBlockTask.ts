import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { taskKeys } from '@/hooks/api/useTasks';
import {
  blockTask,
  type TaskBlockerResponseDto,
  type TaskResponseDto,
} from '@/lib/api';

type BlockTaskInput = {
  teamId: string;
  taskId: string;
  blockedBy: readonly TaskBlockerResponseDto[];
};

export function useBlockTask(): UseMutationResult<
  TaskResponseDto,
  Error,
  BlockTaskInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, taskId, blockedBy }: BlockTaskInput) => {
      const { data } = await blockTask({
        path: { teamId, taskId },
        body: { blockedBy: blockedBy.map((each) => each.id) },
        throwOnError: true,
      });
      return data;
    },

    onSettled: (_blocked, _error, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
