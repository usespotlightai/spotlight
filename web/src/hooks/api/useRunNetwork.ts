import { useQuery } from '@tanstack/react-query';
import { readRunNetwork } from '@/lib/api';

const runNetworkKeys = {
  forRun: (runId?: string) => ['run-network', runId ?? null] as const,
};

export function useRunNetwork(
  teamId: string | undefined,
  runId: string | undefined,
) {
  return useQuery({
    queryKey: runNetworkKeys.forRun(runId),
    enabled: Boolean(teamId && runId),
    queryFn: async () => {
      const { data } = await readRunNetwork({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
