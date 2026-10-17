import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/hooks/api/useTasks';
import { moveTask } from '@/lib/api';
import { placed, type Task } from '@/lib/task';

type MoveTaskInput = {
  teamId: string;
  lineId: string;
  taskId: string;
  revision: number;
  stationId: string;
  afterTaskId: string | null;
};

export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      lineId,
      taskId,
      revision,
      stationId,
      afterTaskId,
    }: MoveTaskInput) => {
      const { data } = await moveTask({
        path: { teamId, lineId, taskId },
        body: { revision, stationId, afterTaskId },
        throwOnError: true,
      });
      return data;
    },

    onMutate: ({ teamId, taskId, stationId, afterTaskId }) => {
      const key = taskKeys.forTeam(teamId);
      const previous = queryClient.getQueryData<Task[]>(key);

      if (previous) {
        queryClient.setQueryData(
          key,
          placed(previous, taskId, stationId, afterTaskId),
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

    onSettled: (_moved, _error, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
