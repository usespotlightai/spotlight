import { useQuery } from '@tanstack/react-query';
import { readRunMemories } from '@/lib/api';

export const runMemoryKeys = {
  all: ['memories', 'remembered'] as const,
  forRun: (teamId: string, runId: string) =>
    ['memories', 'remembered', teamId, runId] as const,
};

export function useRunMemories(teamId: string, runId: string) {
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
