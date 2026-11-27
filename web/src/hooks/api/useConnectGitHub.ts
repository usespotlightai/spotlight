import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { gitHubKeys } from '@/hooks/api/useGitHub';
import { connectGitHub } from '@/lib/api';
import { required } from '@/lib/required';

export function useConnectGitHub(
  slug: string | undefined,
  installationId: string | null,
): UseQueryResult<boolean> {
  return useQuery({
    queryKey: gitHubKeys.connection(slug, installationId),
    enabled: Boolean(slug) && Boolean(installationId),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
    meta: { persist: false },
    queryFn: async () => {
      await connectGitHub({
        path: { slug: required(slug) },
        body: { installationId: required(installationId) },
        throwOnError: true,
      });

      return true;
    },
  });
}
