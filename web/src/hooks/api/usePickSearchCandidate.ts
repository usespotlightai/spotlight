import { useMutation, useQueryClient } from '@tanstack/react-query';
import { searchKeys } from '@/hooks/api/useSearches';
import {
  type ConfigPullRequestResponseDto,
  pickSearchCandidate,
} from '@/lib/api';

type PickInput = { teamId: string; searchId: string; candidateId: string };

export function usePickSearchCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      searchId,
      candidateId,
    }: PickInput): Promise<ConfigPullRequestResponseDto> => {
      const { data } = await pickSearchCandidate({
        path: { teamId, searchId, candidateId },
        throwOnError: true,
      });
      return data;
    },
    onSettled: (_picked, _error, { searchId }) =>
      queryClient.invalidateQueries({ queryKey: searchKeys.detail(searchId) }),
  });
}
