import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/hooks/api/useTasks';
import { setTaskRepository } from '@/lib/api';
import type { Task } from '@/lib/task';

type SetTaskRepositoryInput = {
  teamId: string;
  taskId: string;
  /** The repository to work it in, or null for none. */
  repository: string | null;
};

export function useSetTaskRepository() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      taskId,
      repository,
    }: SetTaskRepositoryInput) => {
      const { data } = await setTaskRepository({
        path: { teamId, taskId },
        body: { repository },
        throwOnError: true,
      });
      return data;
    },

    onMutate: ({ teamId, taskId, repository }) => {
      const key = taskKeys.forTeam(teamId);
      const standing = queryClient.getQueryData<Task[]>(key);

      if (standing) {
        queryClient.setQueryData(
          key,
          standing.map((each) =>
            each.id === taskId ? { ...each, repository } : each,
          ),
        );
      }

      void queryClient.cancelQueries({ queryKey: key });

      return { standing };
    },

    onError: (_error, { teamId }, context) => {
      if (context?.standing) {
        queryClient.setQueryData(taskKeys.forTeam(teamId), context.standing);
      }
    },

    onSettled: (_updated, _error, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
