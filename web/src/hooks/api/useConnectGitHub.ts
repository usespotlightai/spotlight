import { useQuery } from '@tanstack/react-query';
import { connectGitHub } from '@/lib/api';

export const gitHubKeys = {
  connection: (slug?: string, installationId?: string | null) =>
    ['github', 'connect', slug ?? null, installationId ?? null] as const,
};

export function useConnectGitHub(
  slug: string | undefined,
  installationId: string | null,
) {
  return useQuery({
    queryKey: gitHubKeys.connection(slug, installationId),
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
