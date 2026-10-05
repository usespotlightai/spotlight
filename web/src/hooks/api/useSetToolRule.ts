import { useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionKeys } from '@/hooks/api/useConnections';
import { type SetToolRuleRequestDto, setMyToolRule } from '@/lib/api';

type SetToolRule = {
  readonly source: string;
  readonly tool: string;
  readonly rule: SetToolRuleRequestDto['rule'];
};

export function useSetToolRule(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ source, tool, rule }: SetToolRule) => {
      await setMyToolRule({
        path: { teamId, source, tool },
        body: { rule },
        throwOnError: true,
      });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: connectionKeys.forTeam(teamId),
      }),
  });
}
