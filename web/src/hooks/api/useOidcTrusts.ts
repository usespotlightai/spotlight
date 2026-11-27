import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  listWorkspaceOidcTrusts,
  type OidcTrustSummaryResponseDto,
} from '@/lib/api';
import { required } from '@/lib/required';

const oidcTrustKeys = {
  forWorkspace: (slug?: string) => ['oidc-trusts', slug ?? null] as const,
};

export function useOidcTrusts(
  slug: string | undefined,
): UseQueryResult<OidcTrustSummaryResponseDto[]> {
  return useQuery({
    queryKey: oidcTrustKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data } = await listWorkspaceOidcTrusts({
        path: { slug: required(slug) },
        throwOnError: true,
      });
      return data;
    },
  });
}
