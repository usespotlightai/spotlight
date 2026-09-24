import { useQuery } from '@tanstack/react-query';
import { listConnectedRunners, listRunnerActivity } from '@/lib/api';
import { withActivity } from '@/lib/runner';

export const runnerKeys = {
  all: ['runners'] as const,
  forWorkspace: (slug?: string) => ['runners', slug ?? null] as const,
};

const HEARTBEAT_POLL_MS = 5_000;

export function useRunners(slug: string | undefined) {
  return useQuery({
    queryKey: runnerKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    staleTime: 0,
    refetchInterval: HEARTBEAT_POLL_MS,
    queryFn: async () => {
      const path = { slug: slug as string };
      const [runners, activity] = await Promise.all([
        listConnectedRunners({ path, throwOnError: true }),
        listRunnerActivity({ path, throwOnError: true }),
      ]);
      return withActivity(runners.data, activity.data);
    },
  });
}
