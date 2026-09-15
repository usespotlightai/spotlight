import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/api/useChats';
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
    onSuccess: (_dismissed, { chatId }) =>
      queryClient.invalidateQueries({ queryKey: chatKeys.one(chatId) }),
  });
}
