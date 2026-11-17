import { useMutation, useQueryClient } from '@tanstack/react-query';

import { taskKeys } from '@/hooks/api/useTasks';
import { addTask } from '@/lib/api';
import { refreshAfterWrite } from '@/lib/live-writes';
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
      const { data, response } = await addTask({
        path: { teamId, lineId, stationId },
        body: {
          title: task.title,
          description: task.description || null,
          attachments: task.attachments,
        },
        throwOnError: true,
      });
      await refreshAfterWrite(queryClient, response, [
        taskKeys.forTeam(teamId),
      ]);
      return data;
    },
  });
}
