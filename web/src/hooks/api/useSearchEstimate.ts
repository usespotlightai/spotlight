import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { searchKeys } from '@/hooks/api/useSearches';
import { estimateSearch } from '@/lib/api';
import type { ReplayedStation } from '@/lib/replay';
import type { SearchBudget, SearchEstimate } from '@/lib/search';

type EstimateInput = {
  readonly setId: string;
  readonly budget: SearchBudget;
};

export function useSearchEstimate(
  at: ReplayedStation,
  input: EstimateInput | null,
) {
  return useQuery({
    queryKey: searchKeys.estimate(at.stationId, input),
    enabled: input !== null,
    retry: false,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<SearchEstimate> => {
      const { data } = await estimateSearch({
        path: {
          teamId: at.teamId,
          lineId: at.lineId,
          stationId: at.stationId,
        },
        body: input as EstimateInput,
        throwOnError: true,
      });
      return data;
    },
  });
}
