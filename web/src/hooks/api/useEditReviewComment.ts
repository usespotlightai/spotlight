import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { reviewKeys } from '@/hooks/api/useTaskReview';
import { editReviewComment } from '@/lib/api';

type EditReviewCommentInput = {
  teamId: string;
  taskId: string;
  commentId: string;
  body: string;
};

export function useEditReviewComment(): UseMutationResult<
  void,
  Error,
  EditReviewCommentInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      taskId,
      commentId,
      body,
    }: EditReviewCommentInput) => {
      await editReviewComment({
        path: { teamId, taskId, commentId },
        body: { body },
        throwOnError: true,
      });
    },

    onSuccess: (_, { taskId }) =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.forTask(taskId) }),
  });
}
