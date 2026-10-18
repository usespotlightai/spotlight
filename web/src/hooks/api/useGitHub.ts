import { useQuery } from '@tanstack/react-query';
import { readGitHub } from '@/lib/api';

export const gitHubKeys = {
  status: (slug?: string) => ['github', 'status', slug ?? null] as const,
  connection: (slug?: string, installationId?: string | null) =>
    ['github', 'connect', slug ?? null, installationId ?? null] as const,
};

const POLL_MS = 10_000;

export function useGitHub(slug: string | undefined) {
  return useQuery({
    queryKey: gitHubKeys.status(slug),
    enabled: Boolean(slug),
    refetchInterval: (query) => (query.state.data?.connected ? false : POLL_MS),
    queryFn: async () => {
      const { data } = await readGitHub({
        path: { slug: slug as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
