import { useQuery } from '@tanstack/react-query';
import { readRunConfig } from '@/lib/api';

export const runConfigKeys = {
  forRun: (runId?: string) => ['run-config', runId ?? null] as const,
};

export function useRunConfig(teamId?: string, runId?: string) {
  return useQuery({
    queryKey: runConfigKeys.forRun(runId),
    enabled: Boolean(teamId && runId),
    queryFn: async () => {
      const { data } = await readRunConfig({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
