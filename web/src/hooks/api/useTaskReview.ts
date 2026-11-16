import { useQuery } from '@tanstack/react-query';

import { readTaskReview } from '@/lib/api';

export const reviewKeys = {
  forTask: (taskId?: string | null) => ['review', taskId ?? null] as const,
};

const POLL_MS = 10_000;

export function useTaskReview(teamId?: string, taskId?: string | null) {
  return useQuery({
    queryKey: reviewKeys.forTask(taskId),
    enabled: Boolean(teamId && taskId),
    refetchInterval: (query) =>
      query.state.data?.comments.some((each) => each.state === 'sending') ||
      query.state.data?.reviews.some((each) => each.state === 'sending')
        ? POLL_MS
        : false,
    queryFn: async () => {
      const { data } = await readTaskReview({
        path: { teamId: teamId as string, taskId: taskId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
