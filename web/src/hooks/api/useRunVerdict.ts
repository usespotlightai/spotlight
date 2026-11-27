import {
  type QueryClient,
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { runScoreKeys } from '@/hooks/api/useRunScores';
import { stationInsightsKeys } from '@/hooks/api/useStationInsights';
import { stationJudgeKeys } from '@/hooks/api/useStationJudge';
import { clearRunVerdict, recordRunVerdict } from '@/lib/api';
import type { RunScores } from '@/lib/judge';

type RunOf = {
  teamId: string;
  runId: string;
};

type RecordRunVerdictInput = RunOf & {
  right: boolean;
  reason: string | null;
};

const settled = (queryClient: QueryClient, scores: RunScores) => {
  queryClient.setQueryData(runScoreKeys.forRun(scores.runId), scores);
  void queryClient.invalidateQueries({
    queryKey: stationInsightsKeys.forStation(scores.stationId),
  });
  void queryClient.invalidateQueries({
    queryKey: stationJudgeKeys.forStation(scores.stationId),
  });
};

export function useRecordRunVerdict(): UseMutationResult<
  RunScores,
  Error,
  RecordRunVerdictInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, runId, right, reason }) => {
      const { data } = await recordRunVerdict({
        path: { teamId, runId },
        body: { right, reason },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (scores) => settled(queryClient, scores),
  });
}

export function useClearRunVerdict(): UseMutationResult<
  RunScores,
  Error,
  RunOf
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ teamId, runId }) => {
      const { data } = await clearRunVerdict({
        path: { teamId, runId },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (scores) => settled(queryClient, scores),
  });
}
