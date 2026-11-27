import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readRunScores } from '@/lib/api';
import type { RunScores } from '@/lib/judge';
import { required } from '@/lib/required';

export const runScoreKeys = {
  forRun: (runId?: string) => ['run-scores', runId ?? null] as const,
};

export function useRunScores(
  teamId: string | undefined,
  runId: string | undefined,
): UseQueryResult<RunScores> {
  return useQuery({
    queryKey: runScoreKeys.forRun(runId),
    enabled: Boolean(teamId) && Boolean(runId),
    queryFn: async (): Promise<RunScores> => {
      const { data } = await readRunScores({
        path: { teamId: required(teamId), runId: required(runId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
