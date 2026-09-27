import { useQuery } from '@tanstack/react-query';
import { readMemoryReview } from '@/lib/api';

export const memoryReviewKeys = {
  forRun: (runId?: string) => ['memories', 'run', runId ?? null] as const,
};

type MemoryReviewOf = {
  teamId?: string;
  taskId?: string;
  runId?: string;
};

export function useMemoryReview({ teamId, taskId, runId }: MemoryReviewOf) {
  return useQuery({
    queryKey: memoryReviewKeys.forRun(runId),
    enabled: Boolean(teamId && taskId && runId),
    queryFn: async () => {
      const { data } = await readMemoryReview({
        path: {
          teamId: teamId as string,
          taskId: taskId as string,
          runId: runId as string,
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
