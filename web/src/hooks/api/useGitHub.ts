import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readGitHub, type GitHubConnectionStatusResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

export const gitHubKeys = {
  status: (slug?: string) => ['github', 'status', slug ?? null] as const,
  connection: (slug?: string, installationId?: string | null) =>
    ['github', 'connect', slug ?? null, installationId ?? null] as const,
};

const POLL_MS = 10_000;

export function useGitHub(
  slug: string | undefined,
): UseQueryResult<GitHubConnectionStatusResponseDto> {
  return useQuery({
    queryKey: gitHubKeys.status(slug),
    enabled: Boolean(slug),
    refetchInterval: (query) =>
      query.state.data?.connected === true ? false : POLL_MS,
    queryFn: async () => {
      const { data } = await readGitHub({
        path: { slug: required(slug) },
        throwOnError: true,
      });
      return data;
    },
  });
}
