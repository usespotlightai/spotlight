import { useQuery } from '@tanstack/react-query';
import { listRunnerActivity, listRunners } from '@/lib/api';
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
      const [fleet, activity] = await Promise.all([
        listRunners({ path, throwOnError: true }),
        listRunnerActivity({ path, throwOnError: true }),
      ]);
      return withActivity(fleet.data, activity.data);
    },
  });
}
