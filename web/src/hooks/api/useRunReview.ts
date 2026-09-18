import { useQuery } from '@tanstack/react-query';
import { readRunReview } from '@/lib/api';

export const reviewKeys = {
  forRun: (runId?: string) => ['review', runId ?? null] as const,
};

const POLL_MS = 10_000;

export function useRunReview(teamId?: string, runId?: string) {
  return useQuery({
    queryKey: reviewKeys.forRun(runId),
    enabled: Boolean(teamId && runId),
    refetchInterval: (query) =>
      query.state.data?.comments.some((each) => each.state === 'sending') ||
      query.state.data?.reviews.some((each) => each.state === 'sending')
        ? POLL_MS
        : false,
    queryFn: async () => {
      const { data } = await readRunReview({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
