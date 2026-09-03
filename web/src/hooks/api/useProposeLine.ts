import { useMutation, useQueryClient } from '@tanstack/react-query';
import { configurationKeys } from '@/hooks/api/useConfiguration';
import { proposeLine } from '@/lib/api';

/**
 * Writes a line back to the repository as a pull request. The board is ahead
 * of the repository until somebody merges it, which is the point.
 */
export function useProposeLine(teamId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lineId: string) => {
      const { data } = await proposeLine({
        path: { teamId: teamId as string, lineId },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: configurationKeys.forTeam(teamId),
      });
    },
  });
}
