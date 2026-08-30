import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/hooks/api/useTasks';
import { addTask } from '@/lib/api';
import type { NewTask } from '@/lib/task';

type AddTaskInput = {
  teamId: string;
  lineId: string;
  stationId: string;
  task: NewTask;
};

export function useAddTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, lineId, stationId, task }: AddTaskInput) => {
      const { data } = await addTask({
        path: { teamId, lineId, stationId },
        body: { title: task.title, description: task.description || null },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (_added, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
