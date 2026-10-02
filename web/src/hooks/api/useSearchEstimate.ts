import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { searchKeys } from '@/hooks/api/useSearches';
import { estimateSearch } from '@/lib/api';
import type { ReplayedStation } from '@/lib/replay';
import type { SearchBudget, SearchEstimate } from '@/lib/search';

type EstimateAsked = {
  readonly setId: string;
  readonly budget: SearchBudget;
};

export function useSearchEstimate(
  at: ReplayedStation,
  asked: EstimateAsked | null,
) {
  return useQuery({
    queryKey: searchKeys.estimate(at.stationId, asked),
    enabled: asked !== null,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SearchEstimate> => {
      const { data } = await estimateSearch({
        path: {
          teamId: at.teamId,
          lineId: at.lineId,
          stationId: at.stationId,
        },
        body: asked as EstimateAsked,
        throwOnError: true,
      });
      return data;
    },
  });
}
