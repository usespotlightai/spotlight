import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assemblyLineKeys } from '@/hooks/api/useAssemblyLines';
import { setLineReactions } from '@/lib/api';

type Reaction = {
  happening: string;
  from?: string | null;
  to: string;
};

type SetLineReactionsInput = {
  teamId: string;
  lineId: string;
  /** The whole set. Anything left out stops applying. */
  reactions: Reaction[];
};

export function useSetLineReactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      lineId,
      reactions,
    }: SetLineReactionsInput) => {
      const { data } = await setLineReactions({
        path: { teamId, lineId },
        body: { reactions },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (_line, { teamId }) =>
      queryClient.invalidateQueries({
        queryKey: assemblyLineKeys.forTeam(teamId),
      }),
  });
}
