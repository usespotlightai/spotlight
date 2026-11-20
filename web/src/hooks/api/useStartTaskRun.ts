import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  refreshTask,
  startsTaskRunKey,
  type TaskRef,
} from '@/hooks/api/useSendMessage';
import { startTaskRun } from '@/lib/api';

export function useStartTaskRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: startsTaskRunKey,
    mutationFn: async ({ teamId, taskId }: TaskRef) => {
      const { data } = await startTaskRun({
        path: { teamId, taskId },
        throwOnError: true,
      });
      return data;
    },
    onSettled: (_task, _error, { teamId }) => refreshTask(queryClient, teamId),
  });
}
