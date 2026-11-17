import {
  useMutation,
  useMutationState,
  useQueryClient,
} from '@tanstack/react-query';

import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { sendMessage } from '@/lib/api';
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
