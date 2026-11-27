import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { memoryReviewKeys } from '@/hooks/api/useMemoryReview';
import { approveMemories, type MemoryReviewResponseDto } from '@/lib/api';
import { decidedMemories, type ProposedMemory } from '@/lib/memory';

type ApproveMemoriesInput = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  memories: readonly { id: string; body?: string }[];
};

export function useApproveMemories(): UseMutationResult<
  MemoryReviewResponseDto,
  Error,
  ApproveMemoriesInput,
  void
> {
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

    onMutate: async ({ runId, memories }) => {
      const key = memoryReviewKeys.forRun(runId);
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<{ memories: ProposedMemory[] }>(
        key,
        (review) => review && decidedMemories(review, memories, 'approved'),
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
