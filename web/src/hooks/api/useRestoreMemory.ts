import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { memoryReviewKeys } from '@/hooks/api/useMemoryReview';
import { restoreMemory, type MemoryReviewResponseDto } from '@/lib/api';
import { type ProposedMemory, restoredMemory } from '@/lib/memory';

type RestoreMemoryInput = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  memoryId: string;
};

export function useRestoreMemory(): UseMutationResult<
  MemoryReviewResponseDto,
  Error,
  RestoreMemoryInput,
  void
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      taskId,
      runId,
      memoryId,
    }: RestoreMemoryInput) => {
      const { data } = await restoreMemory({
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
        (review) => review && restoredMemory(review, memoryId),
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
