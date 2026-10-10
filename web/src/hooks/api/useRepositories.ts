import { useQuery } from '@tanstack/react-query';
import { listRepositories } from '@/lib/api';

const repositoryKeys = {
  forWorkspace: (slug?: string) => ['repositories', slug ?? null] as const,
};

export function useRepositories(slug: string | undefined) {
  return useQuery({
    queryKey: repositoryKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await listRepositories({
        path: { slug: slug as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
