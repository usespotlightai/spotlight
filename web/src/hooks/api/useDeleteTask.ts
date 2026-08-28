import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/hooks/api/useTasks';
import { deleteTask } from '@/lib/api';

type DeleteTaskInput = {
  teamId: string;
  taskId: string;
};

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, taskId }: DeleteTaskInput) => {
      await deleteTask({ path: { teamId, taskId }, throwOnError: true });
    },
    onSuccess: (_gone, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
