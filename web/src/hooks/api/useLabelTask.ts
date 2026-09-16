import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/hooks/api/useTasks';
import { labelTask } from '@/lib/api';

type LabelTaskInput = {
  teamId: string;
  taskId: string;
  labelId: string;
};

export function useLabelTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, taskId, labelId }: LabelTaskInput) => {
      await labelTask({
        path: { teamId, taskId, labelId },
        throwOnError: true,
      });
    },

    onSettled: (_data, _error, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
