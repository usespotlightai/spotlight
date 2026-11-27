import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { listHarnesses, type HarnessResponseDto } from '@/lib/api';

export const harnessKeys = {
  forWorkspace: (slug: string) => ['harnesses', slug] as const,
};

export function useHarnesses(): UseQueryResult<HarnessResponseDto[]> {
  const { slug = '' } = useParams();

  return useQuery({
    queryKey: harnessKeys.forWorkspace(slug),
    staleTime: Number.POSITIVE_INFINITY,
    enabled: slug !== '',
    queryFn: async () => {
      const { data } = await listHarnesses({
        path: { slug },
        throwOnError: true,
      });
      return data;
    },
  });
}
