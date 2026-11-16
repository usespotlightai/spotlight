import { useMutation, useQueryClient } from '@tanstack/react-query';

import { reviewKeys } from '@/hooks/api/useTaskReview';
import { submitReview } from '@/lib/api';
import type { ReviewVerdict } from '@/lib/review';

type SubmitReviewInput = {
  teamId: string;
  taskId: string;
  repository: string | null;
  verdict: ReviewVerdict;
  body: string;
};

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      taskId,
      repository,
      verdict,
      body,
    }: SubmitReviewInput) => {
      await submitReview({
        path: { teamId, taskId },
        body: { verdict, body, ...(repository ? { repository } : {}) },
        throwOnError: true,
      });
    },

    onSuccess: (_, { taskId }) =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.forTask(taskId) }),
  });
}
