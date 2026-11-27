import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { chatKeys } from '@/hooks/api/useChats';
import { inboxKeys } from '@/hooks/api/useInbox';
import { journalKeys } from '@/hooks/api/useRunJournals';
import { startChat, type ChatResponseDto } from '@/lib/api';
import type { ChatSetup } from '@/lib/chat';
import { refreshAfterWrite } from '@/lib/live-writes';
import { nonEmpty } from '@/lib/non-empty';

type StartChatInput = {
  teamId: string;
  harness: string;
  model: string | null;
  effort: string | null;
  repositories: string[];
  body: string;
  attachments: string[];
  traces: string[];
  targetStation?: string;
  setup?: ChatSetup;
};

export function useStartChat(): UseMutationResult<
  ChatResponseDto,
  Error,
  StartChatInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, ...body }: StartChatInput) => {
      const { data, response } = await startChat({
        path: { teamId },
        body,
        throwOnError: true,
      });
      queryClient.setQueryData(chatKeys.one(data.id), data);
      if (nonEmpty(data.runId)) {
        const fresh = { updatedAt: 0 };
        queryClient.setQueryData(
          journalKeys.runsOfChat(data.id),
          [
            {
              runId: data.runId,
              createdAt: data.createdAt,
              stepCount: 0,
              messageCount: 0,
            },
          ],
          fresh,
        );
        queryClient.setQueryData(journalKeys.ofRun(data.runId), [], fresh);
      }
      void refreshAfterWrite(queryClient, response, [
        inboxKeys.all,
        chatKeys.forTeam(teamId),
      ]);
      return data;
    },
  });
}
