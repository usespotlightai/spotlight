import { useQuery } from '@tanstack/react-query';
import { listInbox } from '@/lib/api';

export const inboxKeys = {
  forWorkspace: (slug?: string) => ['inbox', slug ?? null] as const,
};

const POLL_MS = 10_000;

export function useInbox(slug: string | undefined) {
  return useQuery({
    queryKey: inboxKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    // Tasks arrive here on their own, with nobody clicking anything.
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await listInbox({
        path: { slug: slug as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
