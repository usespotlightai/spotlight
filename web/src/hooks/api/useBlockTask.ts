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
import type { Task } from '@/lib/task';

type BlockTaskInput = {
  teamId: string;
  taskId: string;
  blockedBy: readonly TaskBlockerResponseDto[];
};

export function useBlockTask(): UseMutationResult<
  TaskResponseDto,
  Error,
  BlockTaskInput,
  { previous: TaskResponseDto[] | undefined }
> {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { optimistic: true },
    mutationFn: async ({ teamId, taskId, blockedBy }: BlockTaskInput) => {
      const { data } = await blockTask({
        path: { teamId, taskId },
        body: { blockedBy: blockedBy.map((each) => each.id) },
        throwOnError: true,
      });
      return data;
    },

    onMutate: ({ teamId, taskId, blockedBy }) => {
      const key = taskKeys.forTeam(teamId);
      const previous = queryClient.getQueryData<Task[]>(key);

      if (previous) {
        queryClient.setQueryData(
          key,
          previous.map((each) =>
            each.id === taskId ? { ...each, blockedBy: [...blockedBy] } : each,
          ),
        );
      }

      void queryClient.cancelQueries({ queryKey: key });

      return { previous };
    },

    onError: (_error, { teamId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(taskKeys.forTeam(teamId), context.previous);
      }
    },

    onSettled: (_blocked, _error, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
