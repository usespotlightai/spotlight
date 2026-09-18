import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewKeys } from '@/hooks/api/useRunReview';
import { editReviewComment } from '@/lib/api';

type EditReviewCommentInput = {
  teamId: string;
  runId: string;
  commentId: string;
  body: string;
};

export function useEditReviewComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      runId,
      commentId,
      body,
    }: EditReviewCommentInput) => {
      await editReviewComment({
        path: { teamId, runId, commentId },
        body: { body },
        throwOnError: true,
      });
    },

    onSuccess: (_, { runId }) =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.forRun(runId) }),
  });
}
