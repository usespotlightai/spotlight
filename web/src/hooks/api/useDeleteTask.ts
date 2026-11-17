import { useMutation, useQueryClient } from '@tanstack/react-query';

import { taskKeys } from '@/hooks/api/useTasks';
import { deleteTask } from '@/lib/api';
import { refreshAfterWrite } from '@/lib/live-writes';

type DeleteTaskInput = {
  teamId: string;
  taskId: string;
};

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, taskId }: DeleteTaskInput) => {
      const { response } = await deleteTask({
        path: { teamId, taskId },
        throwOnError: true,
      });
      await refreshAfterWrite(queryClient, response, [
        taskKeys.forTeam(teamId),
      ]);
    },
  });
}
