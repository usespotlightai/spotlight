import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { gitHubKeys } from '@/hooks/api/useGitHub';
import {
  type GitHubInstallationResponseDto,
  listGitHubInstallations,
} from '@/lib/api';
import { nonEmpty } from '@/lib/non-empty';
import { required } from '@/lib/required';

export function useGitHubInstallations(
  slug: string | undefined,
): UseQueryResult<GitHubInstallationResponseDto[]> {
  return useQuery({
    queryKey: gitHubKeys.installations(slug),
    enabled: nonEmpty(slug),
    retry: false,
    queryFn: async () => {
      const { data } = await listGitHubInstallations({
        path: { slug: required(slug) },
        throwOnError: true,
      });
      return data;
    },
  });
}
