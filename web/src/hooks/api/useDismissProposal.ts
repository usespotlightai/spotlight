import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/api/useChats';
import { inboxKeys } from '@/hooks/api/useInbox';
import { dismissProposal } from '@/lib/api';

type DismissProposalInput = {
  teamId: string;
  chatId: string;
  position: number;
};

export function useDismissProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, chatId, position }: DismissProposalInput) => {
      await dismissProposal({
        path: { teamId, chatId, position },
        throwOnError: true,
      });
    },
    onSuccess: (_dismissed, { chatId }) => {
      void queryClient.invalidateQueries({ queryKey: inboxKeys.all });

      return queryClient.invalidateQueries({ queryKey: chatKeys.one(chatId) });
    },
  });
}
