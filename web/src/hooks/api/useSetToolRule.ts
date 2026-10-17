import { useMutation, useQueryClient } from '@tanstack/react-query';
import { connectionKeys } from '@/hooks/api/useIntegrationConnections';
import { type SetToolRuleRequestDto, setMyToolRule } from '@/lib/api';

type SetToolRule = {
  readonly integration: string;
  readonly tool: string;
  readonly rule: SetToolRuleRequestDto['rule'];
};

export function useSetToolRule(teamId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ integration, tool, rule }: SetToolRule) => {
      await setMyToolRule({
        path: { teamId, integration, tool },
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
