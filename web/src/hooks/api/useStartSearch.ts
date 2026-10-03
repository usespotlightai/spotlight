import { useMutation, useQueryClient } from '@tanstack/react-query';
import { searchKeys } from '@/hooks/api/useSearches';
import { type SearchStartedResponseDto, startSearch } from '@/lib/api';
import type { ReplayedStation } from '@/lib/replay';
import type { SearchAgent, SearchBudget } from '@/lib/search';
import type { SearchObjective } from '@/lib/search-words';

type StartSearchInput = {
  at: ReplayedStation;
  setId: string;
  budget: SearchBudget;
  agent: SearchAgent;
  objective: SearchObjective | null;
};

export function useStartSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      at,
      setId,
      budget,
      agent,
      objective,
    }: StartSearchInput): Promise<SearchStartedResponseDto> => {
      const { data } = await startSearch({
        path: {
          teamId: at.teamId,
          lineId: at.lineId,
          stationId: at.stationId,
        },
        body: {
          setId,
          budget,
          agent,
          ...(objective ? { objective } : {}),
        },
        throwOnError: true,
      });
      return data;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: searchKeys.all }),
  });
}
