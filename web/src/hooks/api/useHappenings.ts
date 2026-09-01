import { useQuery } from '@tanstack/react-query';
import { listHappenings } from '@/lib/api';

export const happeningKeys = {
  forWorkspace: (slug?: string) => ['happenings', slug ?? null] as const,
};

export function useHappenings(slug: string | undefined) {
  return useQuery({
    queryKey: happeningKeys.forWorkspace(slug),
    enabled: Boolean(slug),
    // What the connected sources raise changes only when one is connected.
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await listHappenings({
        path: { slug: slug as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
