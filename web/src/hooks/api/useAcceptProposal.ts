import { useMutation, useQueryClient } from '@tanstack/react-query';

import { chatKeys } from '@/hooks/api/useChats';
import { inboxKeys } from '@/hooks/api/useInbox';
import { taskKeys } from '@/hooks/api/useTasks';
import { acceptProposal } from '@/lib/api';
import { refreshAfterWrite } from '@/lib/live-writes';

type AcceptProposalInput = {
  teamId: string;
  chatId: string;
  position: number;
};

export function useAcceptProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, chatId, position }: AcceptProposalInput) => {
      const { response } = await acceptProposal({
        path: { teamId, chatId, position },
        throwOnError: true,
      });
      void refreshAfterWrite(queryClient, response, [
        chatKeys.one(chatId),
        inboxKeys.all,
        taskKeys.forTeam(teamId),
      ]);
    },
  });
}
