import { useQuery } from '@tanstack/react-query';
import { searchKeys } from '@/hooks/api/useSearches';
import { readSearch } from '@/lib/api';
import { type SearchDetail, stillMoving } from '@/lib/search';

const POLL_MS = 10_000;

export function useSearch(
  teamId: string | undefined,
  searchId: string | undefined,
) {
  return useQuery({
    queryKey: searchKeys.detail(searchId),
    enabled: Boolean(teamId && searchId),
    refetchInterval: (query) =>
      query.state.data && stillMoving(query.state.data) ? POLL_MS : false,
    queryFn: async (): Promise<SearchDetail> => {
      const { data } = await readSearch({
        path: { teamId: teamId as string, searchId: searchId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
