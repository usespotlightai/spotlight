import { useQuery } from '@tanstack/react-query';
import { listHarnesses } from '@/lib/api';

export const harnessKeys = {
  all: ['harnesses'] as const,
};

export function useHarnesses() {
  return useQuery({
    queryKey: harnessKeys.all,
    // Changes when Spotlight does, not while anyone is looking at it.
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { data } = await listHarnesses({ throwOnError: true });
      return data;
    },
  });
}
