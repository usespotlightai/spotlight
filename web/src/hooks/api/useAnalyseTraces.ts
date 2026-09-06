import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskKeys } from '@/hooks/api/useTasks';
import { analyseTraces } from '@/lib/api';

type AnalyseTracesInput = {
  teamId: string;
  /** The tasks whose traces to analyse, one work item each. */
  taskIds: readonly string[];
};

export function useAnalyseTraces() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, taskIds }: AnalyseTracesInput) => {
      const { data } = await analyseTraces({
        path: { teamId },
        body: { taskIds: [...taskIds] },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (_created, { teamId }) =>
      queryClient.invalidateQueries({ queryKey: taskKeys.forTeam(teamId) }),
  });
}
