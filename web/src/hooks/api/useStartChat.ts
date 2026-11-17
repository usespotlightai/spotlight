import { useMutation, useQueryClient } from '@tanstack/react-query';

import { chatKeys } from '@/hooks/api/useChats';
import { inboxKeys } from '@/hooks/api/useInbox';
import { startChat } from '@/lib/api';
import type { ChatSetup } from '@/lib/chat';
import { refreshAfterWrite } from '@/lib/live-writes';

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

export function useStartChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, ...body }: StartChatInput) => {
      const { data, response } = await startChat({
        path: { teamId },
        body,
        throwOnError: true,
      });
      queryClient.setQueryData(chatKeys.one(data.id), data);
      void refreshAfterWrite(queryClient, response, [
        inboxKeys.all,
        chatKeys.forTeam(teamId),
      ]);
      return data;
    },
  });
}
