import { useQuery } from '@tanstack/react-query';
import { readRunScores } from '@/lib/api';
import type { RunScores } from '@/lib/judge';

export const runScoreKeys = {
  forRun: (runId?: string) => ['run-scores', runId ?? null] as const,
};

export function useRunScores(
  teamId: string | undefined,
  runId: string | undefined,
) {
  return useQuery({
    queryKey: runScoreKeys.forRun(runId),
    enabled: Boolean(teamId && runId),
    queryFn: async (): Promise<RunScores> => {
      const { data } = await readRunScores({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
