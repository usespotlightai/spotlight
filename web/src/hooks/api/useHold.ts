import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { taskKeys } from '@/hooks/api/useTasks';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { type HoldEnd, type HoldVerdict, resumeLine } from '@/lib/api';

type HoldEndInput = {
  teamId: string;
  taskId: string;
  next: HoldEnd;
  stationId?: string;
  verdict?: HoldVerdict;
  summary?: string;
};

const refresh = (queryClient: QueryClient, teamId: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
    queryClient.invalidateQueries({ queryKey: teamRunKeys.all }),
    queryClient.invalidateQueries({ queryKey: runNotesKeys.all }),
    queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
  ]);

export function useResumeLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, taskId, ...body }: HoldEndInput) => {
      const { data } = await resumeLine({
        path: { teamId, taskId },
        body,
        throwOnError: true,
      });
      return data;
    },
    onSettled: (_task, _error, { teamId }) => refresh(queryClient, teamId),
  });
}
