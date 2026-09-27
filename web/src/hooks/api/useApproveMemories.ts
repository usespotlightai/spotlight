import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { memoryReviewKeys } from '@/hooks/api/useMemoryReview';
import { approveMemories } from '@/lib/api';

type ApproveMemoriesInput = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  memories: readonly { id: string; body?: string }[];
};

export function useApproveMemories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      taskId,
      runId,
      memories,
    }: ApproveMemoriesInput) => {
      const { data } = await approveMemories({
        path: { teamId, taskId, runId },
        body: { memories: [...memories] },
        throwOnError: true,
      });
      return data;
    },

    onSuccess: (review, { slug, runId }) => {
      queryClient.setQueryData(memoryReviewKeys.forRun(runId), review);
      void queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      });
    },
  });
}
