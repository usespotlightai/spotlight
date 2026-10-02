import { useMutation, useQueryClient } from '@tanstack/react-query';
import { searchKeys } from '@/hooks/api/useSearches';
import { stopSearch } from '@/lib/api';

type StopSearchInput = { teamId: string; searchId: string };

export function useStopSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, searchId }: StopSearchInput) => {
      await stopSearch({ path: { teamId, searchId }, throwOnError: true });
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: searchKeys.all }),
  });
}
