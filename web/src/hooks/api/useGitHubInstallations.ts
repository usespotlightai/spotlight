import { useQuery } from '@tanstack/react-query';

import { gitHubKeys } from '@/hooks/api/useGitHub';
import { listGitHubInstallations } from '@/lib/api';

export function useGitHubInstallations(slug: string | undefined) {
  return useQuery({
    queryKey: gitHubKeys.installations(slug),
    enabled: Boolean(slug),
    retry: false,
    queryFn: async () => {
      const { data } = await listGitHubInstallations({
        path: { slug: slug as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
