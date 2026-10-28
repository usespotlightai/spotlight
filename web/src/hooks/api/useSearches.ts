import { useQuery } from '@tanstack/react-query';
import { listSearches } from '@/lib/api';
import { ongoingIn, type Search } from '@/lib/search';

export const searchKeys = {
  all: ['searches'] as const,
  forStation: (stationId?: string) =>
    ['searches', 'station', stationId ?? null] as const,
  detail: (searchId?: string) =>
    ['searches', 'detail', searchId ?? null] as const,
};

const POLL_MS = 10_000;

export function useSearches(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
) {
  return useQuery({
    queryKey: searchKeys.forStation(stationId),
    enabled: Boolean(teamId && lineId && stationId),
    refetchInterval: (query) =>
      query.state.data && ongoingIn(query.state.data) ? POLL_MS : false,
    queryFn: async (): Promise<Search[]> => {
      const { data } = await listSearches({
        path: {
          teamId: teamId as string,
          lineId: lineId as string,
          stationId: stationId as string,
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
