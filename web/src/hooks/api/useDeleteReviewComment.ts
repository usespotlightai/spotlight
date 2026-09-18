import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewKeys } from '@/hooks/api/useRunReview';
import { deleteReviewComment } from '@/lib/api';

type DeleteReviewCommentInput = {
  teamId: string;
  runId: string;
  commentId: string;
};

export function useDeleteReviewComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      runId,
      commentId,
    }: DeleteReviewCommentInput) => {
      await deleteReviewComment({
        path: { teamId, runId, commentId },
        throwOnError: true,
      });
    },

    onSuccess: (_, { runId }) =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.forRun(runId) }),
  });
}
