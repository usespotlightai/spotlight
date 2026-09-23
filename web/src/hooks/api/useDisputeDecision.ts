import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskDecisionKeys } from '@/hooks/api/useTaskDecisions';
import { disputeDecision } from '@/lib/api';

type DisputeDecisionInput = {
  teamId: string;
  taskId: string;
  decisionId: string;
  path: string;
  reason: string;
};

export function useDisputeDecision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      taskId,
      decisionId,
      path,
      reason,
    }: DisputeDecisionInput) => {
      const { data } = await disputeDecision({
        path: { teamId, taskId, decisionId },
        body: { path, reason },
        throwOnError: true,
      });
      return data;
    },

    onSuccess: (found, { taskId }) => {
      queryClient.setQueryData(taskDecisionKeys.forTask(taskId), found);
    },
  });
}
