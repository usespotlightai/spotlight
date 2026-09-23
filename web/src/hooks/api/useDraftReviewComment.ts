import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewKeys } from '@/hooks/api/useRunReview';
import { draftReviewComment } from '@/lib/api';
import type { ReviewSpot } from '@/lib/review';

type DraftReviewCommentInput = {
  teamId: string;
  runId: string;
  body: string;
  on: ReviewSpot | { path: string } | { replyTo: string };
};

export function useDraftReviewComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      runId,
      body,
      on,
    }: DraftReviewCommentInput) => {
      await draftReviewComment({
        path: { teamId, runId },
        body: { body, ...on },
        throwOnError: true,
      });
    },

    onSuccess: (_, { runId }) =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.forRun(runId) }),
  });
}
