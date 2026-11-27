import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readTaskReview, type CodeReviewResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

export const reviewKeys = {
  forTask: (taskId?: string | null) => ['review', taskId ?? null] as const,
};

const POLL_MS = 10_000;

export function useTaskReview(
  teamId?: string,
  taskId?: string | null,
): UseQueryResult<CodeReviewResponseDto> {
  return useQuery({
    queryKey: reviewKeys.forTask(taskId),
    enabled: Boolean(teamId) && Boolean(taskId),
    refetchInterval: (query) =>
      query.state.data?.comments.some((each) => each.state === 'sending') ||
      query.state.data?.reviews.some((each) => each.state === 'sending')
        ? POLL_MS
        : false,
    queryFn: async () => {
      const { data } = await readTaskReview({
        path: { teamId: required(teamId), taskId: required(taskId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
