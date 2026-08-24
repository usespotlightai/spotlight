import { useQuery } from '@tanstack/react-query';
import { listRunners } from '@/lib/api';

export const runnerKeys = {
  all: ['runners'] as const,
};

const HEARTBEAT_POLL_MS = 5_000;

export function useRunners() {
  return useQuery({
    queryKey: runnerKeys.all,
    staleTime: 0,
    refetchInterval: HEARTBEAT_POLL_MS,
    queryFn: async () => {
      const { data } = await listRunners({ throwOnError: true });
      return data;
    },
  });
}
