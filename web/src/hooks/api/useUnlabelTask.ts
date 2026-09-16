import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/hooks/api/useTasks';
import { unlabelTask } from '@/lib/api';

type UnlabelTaskInput = {
  teamId: string;
  taskId: string;
  labelId: string;
};

export function useUnlabelTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, taskId, labelId }: UnlabelTaskInput) => {
      await unlabelTask({
        path: { teamId, taskId, labelId },
        throwOnError: true,
      });
    },

    onSettled: (_data, _error, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
