import { useQuery } from '@tanstack/react-query';
import { listWorkspaceOidcTrusts } from '@/lib/api';

const oidcTrustKeys = {
  forWorkspace: (slug?: string) => ['oidc-trusts', slug ?? null] as const,
};

export function useOidcTrusts(slug: string | undefined) {
  return useQuery({
    queryKey: oidcTrustKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await listWorkspaceOidcTrusts({
        path: { slug: slug as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
