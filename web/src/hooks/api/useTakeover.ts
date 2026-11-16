import {
  type QueryClient,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { taskKeys } from '@/hooks/api/useTasks';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import {
  type HandBack,
  handBackTask,
  type TakeoverVerdict,
  takeOverTask,
} from '@/lib/api';

type TakeOverInput = {
  teamId: string;
  taskId: string;
  verdict: TakeoverVerdict;
  body: string;
};

type HandBackInput = {
  teamId: string;
  taskId: string;
  next: HandBack;
  stationId?: string;
  verdict?: TakeoverVerdict;
  summary?: string;
};

const refresh = (queryClient: QueryClient, teamId: string) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
    queryClient.invalidateQueries({ queryKey: teamRunKeys.all }),
    queryClient.invalidateQueries({ queryKey: runNotesKeys.all }),
    queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
  ]);

export function useTakeOverTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, taskId, verdict, body }: TakeOverInput) => {
      const { data } = await takeOverTask({
        path: { teamId, taskId },
        body: { verdict, body },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (_task, { teamId }) => refresh(queryClient, teamId),
  });
}

export function useHandBackTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, taskId, ...body }: HandBackInput) => {
      const { data } = await handBackTask({
        path: { teamId, taskId },
        body,
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (_task, { teamId }) => refresh(queryClient, teamId),
  });
}
