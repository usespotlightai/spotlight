import {
  type QueryClient,
  useMutation,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';

import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { taskKeys } from '@/hooks/api/useTasks';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { sendMessage, sendTaskMessage } from '@/lib/api';
import { refreshAfterWrite } from '@/lib/live-writes';
import type { MessageInFlight, OutgoingMessage } from '@/lib/run-notes';

const sendMessageKey = ['send-message'] as const;

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: sendMessageKey,
    mutationFn: async ({
      teamId,
      runId,
      body,
      attachments,
      coAuthors,
      draftGeneration,
    }: OutgoingMessage) => {
      const { response } = await sendMessage({
        path: { teamId, runId },
        body: { body, attachments, coAuthors, draftGeneration },
        throwOnError: true,
      });
      void refreshAfterWrite(queryClient, response, [
        ['inbox'],
        teamRunKeys.all,
        runNotesKeys.all,
      ]);
    },
  });
}

export type TaskRef = {
  readonly teamId: string;
  readonly taskId: string;
};

type TaskMessage = TaskRef & {
  readonly body: string;
  readonly attachments: string[];
  readonly coAuthors?: string[];
  readonly draftGeneration?: number;
};

export const refreshTask = (queryClient: QueryClient, teamId: string) =>
  Promise.all(
    [
      taskKeys.forTeam(teamId),
      teamRunKeys.all,
      runNotesKeys.all,
      ['inbox'],
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );

export function useSendTaskMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, taskId, ...body }: TaskMessage) => {
      const { data } = await sendTaskMessage({
        path: { teamId, taskId },
        body,
        throwOnError: true,
      });
      return data;
    },
    onSettled: (_task, _error, { teamId }) => refreshTask(queryClient, teamId),
  });
}

export function useMessagesInFlight(
  runIds: readonly string[],
): MessageInFlight[] {
  return useMutationState({
    filters: {
      mutationKey: sendMessageKey,
      predicate: (mutation) =>
        ['pending', 'success'].includes(mutation.state.status) &&
        runIds.includes(
          (mutation.state.variables as OutgoingMessage | undefined)?.runId ??
            '',
        ),
    },
    select: (mutation) => ({
      ...(mutation.state.variables as OutgoingMessage),
      sentAt: mutation.state.submittedAt,
    }),
  });
}
