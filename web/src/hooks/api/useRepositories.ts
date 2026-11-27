import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listRepositories, type RepositoryResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

const repositoryKeys = {
  forWorkspace: (slug?: string) => ['repositories', slug ?? null] as const,
};

export function useRepositories(
  slug: string | undefined,
): UseQueryResult<RepositoryResponseDto[]> {
  return useQuery({
    queryKey: repositoryKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await listRepositories({
        path: { slug: required(slug) },
        throwOnError: true,
      });
      return data;
    },
  });
}
