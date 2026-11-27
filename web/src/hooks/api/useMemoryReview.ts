import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readMemoryReview, type MemoryReviewResponseDto } from '@/lib/api';
import { nonEmpty } from '@/lib/non-empty';
import { required } from '@/lib/required';

export const memoryReviewKeys = {
  forRun: (runId?: string) => ['memories', 'run', runId ?? null] as const,
};

type MemoryReviewOf = {
  teamId?: string;
  taskId?: string;
  runId?: string;
};

export function useMemoryReview({
  teamId,
  taskId,
  runId,
}: MemoryReviewOf): UseQueryResult<MemoryReviewResponseDto> {
  return useQuery({
    queryKey: memoryReviewKeys.forRun(runId),
    enabled: nonEmpty(teamId) && nonEmpty(taskId) && nonEmpty(runId),
    queryFn: async () => {
      const { data } = await readMemoryReview({
        path: {
          teamId: required(teamId),
          taskId: required(taskId),
          runId: required(runId),
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
