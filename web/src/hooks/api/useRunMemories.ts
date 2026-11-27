import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readRunMemories, type RunMemoriesResponseDto } from '@/lib/api';

export const runMemoryKeys = {
  all: ['memories', 'run-memories'] as const,
  forRun: (teamId: string, runId: string) =>
    ['memories', 'run-memories', teamId, runId] as const,
};

export function useRunMemories(
  teamId: string,
  runId: string,
): UseQueryResult<RunMemoriesResponseDto> {
  return useQuery({
    queryKey: runMemoryKeys.forRun(teamId, runId),
    queryFn: async () => {
      const { data } = await readRunMemories({
        path: { teamId, runId },
        throwOnError: true,
      });
      return data;
    },
  });
}
