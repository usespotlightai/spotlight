import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { reviewKeys } from '@/hooks/api/useTaskReview';
import { deleteReviewComment } from '@/lib/api';

type DeleteReviewCommentInput = {
  teamId: string;
  taskId: string;
  commentId: string;
};

export function useDeleteReviewComment(): UseMutationResult<
  void,
  Error,
  DeleteReviewCommentInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      taskId,
      commentId,
    }: DeleteReviewCommentInput) => {
      await deleteReviewComment({
        path: { teamId, taskId, commentId },
        throwOnError: true,
      });
    },

    onSuccess: (_, { taskId }) =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.forTask(taskId) }),
  });
}
