import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/hooks/api/useTasks';
import { assignTask } from '@/lib/api';
import type { Task } from '@/lib/task';

type Person = { id: string; name: string; image: string | null };

type AssignTaskInput = {
  teamId: string;
  taskId: string;
  assignee: Person | null;
};

export function useAssignTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, taskId, assignee }: AssignTaskInput) => {
      const { data } = await assignTask({
        path: { teamId, taskId },
        body: { assigneeId: assignee?.id ?? null },
        throwOnError: true,
      });
      return data;
    },

    onMutate: ({ teamId, taskId, assignee }) => {
      const key = taskKeys.forTeam(teamId);
      const previous = queryClient.getQueryData<Task[]>(key);

      if (previous) {
        queryClient.setQueryData(
          key,
          previous.map((each) =>
            each.id === taskId ? { ...each, assignee } : each,
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

    onSettled: (_assigned, _error, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
