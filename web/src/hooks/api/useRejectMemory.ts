import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { memoryReviewKeys } from '@/hooks/api/useMemoryReview';
import { rejectMemory, type MemoryReviewResponseDto } from '@/lib/api';
import { decidedMemories, type ProposedMemory } from '@/lib/memory';

type RejectMemoryInput = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  memoryId: string;
};

export function useRejectMemory(): UseMutationResult<
  MemoryReviewResponseDto,
  Error,
  RejectMemoryInput,
  void
> {
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

    onMutate: async ({ runId, memoryId }) => {
      const key = memoryReviewKeys.forRun(runId);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<{ memories: ProposedMemory[] }>(
        key,
        (review) =>
          review && decidedMemories(review, [{ id: memoryId }], 'rejected'),
      );
    },

    onError: (_error, { runId }) => {
      void queryClient.invalidateQueries({
        queryKey: memoryReviewKeys.forRun(runId),
      });
    },

    onSuccess: (review, { slug, runId }) => {
      queryClient.setQueryData(memoryReviewKeys.forRun(runId), review);
      void queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      });
    },
  });
}
