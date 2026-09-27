import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/hooks/api/useInbox';
import { memoryReviewKeys } from '@/hooks/api/useMemoryReview';
import { rejectMemory } from '@/lib/api';

type RejectMemoryInput = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  memoryId: string;
};

export function useRejectMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      taskId,
      runId,
      memoryId,
    }: RejectMemoryInput) => {
      const { data } = await rejectMemory({
        path: { teamId, taskId, runId, memoryId },
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
