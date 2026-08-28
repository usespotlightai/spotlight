import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/hooks/api/useTasks';
import { moveTask } from '@/lib/api';

type MoveTaskInput = {
  teamId: string;
  lineId: string;
  taskId: string;
  stationId: string;
};

export function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      lineId,
      taskId,
      stationId,
    }: MoveTaskInput) => {
      const { data } = await moveTask({
        path: { teamId, lineId, taskId },
        body: { stationId },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (_moved, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
