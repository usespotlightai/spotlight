import { useMutation, useQueryClient } from '@tanstack/react-query';
import { chatKeys } from '@/hooks/api/useChats';
import { taskKeys } from '@/hooks/api/useTasks';
import { acceptProposal } from '@/lib/api';

type AcceptProposalInput = {
  teamId: string;
  chatId: string;
  position: number;
};

export function useAcceptProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, chatId, position }: AcceptProposalInput) => {
      await acceptProposal({
        path: { teamId, chatId, position },
        throwOnError: true,
      });
    },
    onSuccess: (_accepted, { teamId, chatId }) => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.one(chatId) });
      void queryClient.invalidateQueries({
        queryKey: taskKeys.forTeam(teamId),
      });
    },
  });
}
