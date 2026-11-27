import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { taskKeys } from '@/hooks/api/useTasks';
import { moveTask } from '@/lib/api';
import { refreshAfterWrite } from '@/lib/live-writes';

type CloseTaskInput = {
  slug: string;
  teamId: string;
  lineId: string;
  taskId: string;
  revision: number;
  completedStationId: string;
};

export function useCloseTask(): UseMutationResult<void, Error, CloseTaskInput> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      slug,
      teamId,
      lineId,
      taskId,
      revision,
      completedStationId,
    }: CloseTaskInput) => {
      const { response } = await moveTask({
        path: { teamId, lineId, taskId },
        body: { revision, stationId: completedStationId, afterTaskId: null },
        throwOnError: true,
      });
      await refreshAfterWrite(queryClient, response, [
        inboxKeys.forWorkspace(slug),
        taskKeys.forTeam(teamId),
        runNotesKeys.all,
      ]);
    },
    onError: (_error, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
