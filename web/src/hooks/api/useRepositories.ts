import { useQuery } from '@tanstack/react-query';
import { listRepositories } from '@/lib/api';

export const repositoryKeys = {
  all: ['repositories'] as const,
};

export function useRepositories() {
  return useQuery({
    queryKey: repositoryKeys.all,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await listRepositories({ throwOnError: true });
      return data;
    },
  });
}
