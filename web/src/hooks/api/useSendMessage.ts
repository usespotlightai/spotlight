import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sendMessage } from '@/lib/api';

type SendMessageInput = {
  teamId: string;
  runId: string;
  body: string;
  attachments: string[];
};

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      runId,
      body,
      attachments,
    }: SendMessageInput) => {
      await sendMessage({
        path: { teamId, runId },
        body: { body, attachments },
        throwOnError: true,
      });
    },

    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox'] }),
  });
}
