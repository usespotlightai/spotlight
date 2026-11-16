import { useMutation, useQueryClient } from '@tanstack/react-query';

import { reviewKeys } from '@/hooks/api/useTaskReview';
import { draftReviewComment } from '@/lib/api';
import type { ReviewSpot } from '@/lib/review';

type DraftReviewCommentInput = {
  teamId: string;
  taskId: string;
  repository: string | null;
  body: string;
  on: ReviewSpot | { path: string } | { replyTo: string };
};

export function useDraftReviewComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      taskId,
      repository,
      body,
      on,
    }: DraftReviewCommentInput) => {
      await draftReviewComment({
        path: { teamId, taskId },
        body: { body, ...on, ...(repository ? { repository } : {}) },
        throwOnError: true,
      });
    },

    onSuccess: (_, { taskId }) =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.forTask(taskId) }),
  });
}
