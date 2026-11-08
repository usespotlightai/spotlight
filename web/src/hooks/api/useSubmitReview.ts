import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewKeys } from '@/hooks/api/useRunReview';
import { submitReview } from '@/lib/api';
import type { ReviewVerdict } from '@/lib/review';

type SubmitReviewInput = {
  teamId: string;
  runId: string;
  repository: string | null;
  verdict: ReviewVerdict;
  body: string;
};

export function useSubmitReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      runId,
      repository,
      verdict,
      body,
    }: SubmitReviewInput) => {
      await submitReview({
        path: { teamId, runId },
        body: { verdict, body, ...(repository ? { repository } : {}) },
        throwOnError: true,
      });
    },

    onSuccess: (_, { runId }) =>
      queryClient.invalidateQueries({ queryKey: reviewKeys.forRun(runId) }),
  });
}
