import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sayToRun } from '@/lib/api';

type SayToRunInput = {
  teamId: string;
  runId: string;
  body: string;
  attachments: string[];
};

export function useSayToRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, runId, body, attachments }: SayToRunInput) => {
      await sayToRun({
        path: { teamId, runId },
        body: { body, attachments },
        throwOnError: true,
      });
    },

    // It joins the task's trail at once, so the conversation shows it before
    // the agent has been given it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox'] }),
  });
}
