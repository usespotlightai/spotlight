import { useMutation, useQueryClient } from '@tanstack/react-query';

import { chatKeys } from '@/hooks/api/useChats';
import { inboxKeys } from '@/hooks/api/useInbox';
import { dismissProposal } from '@/lib/api';
import { refreshAfterWrite } from '@/lib/live-writes';

type DismissProposalInput = {
  teamId: string;
  chatId: string;
  position: number;
};

export function useDismissProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, chatId, position }: DismissProposalInput) => {
      const { response } = await dismissProposal({
        path: { teamId, chatId, position },
        throwOnError: true,
      });
      await refreshAfterWrite(queryClient, response, [
        inboxKeys.all,
        chatKeys.one(chatId),
      ]);
    },
  });
}
