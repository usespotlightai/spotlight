import { useQuery } from '@tanstack/react-query';
import { connectGitHub } from '@/lib/api';

// A query, not a mutation on mount: the redirect page mounts more than once.
export function useConnectGitHub(
  slug: string | undefined,
  installationId: string | null,
) {
  return useQuery({
    queryKey: ['github', 'connect', slug ?? null, installationId],
    enabled: Boolean(slug) && Boolean(installationId),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
    queryFn: async () => {
      await connectGitHub({
        path: { slug: slug as string },
        body: { installationId: installationId as string },
        throwOnError: true,
      });

      return true;
    },
  });
}
